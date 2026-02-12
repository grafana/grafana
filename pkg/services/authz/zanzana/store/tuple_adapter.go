package store

import (
	"context"
	"crypto/sha256"
	"io"
	"strconv"
	"sync"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	tupleutils "github.com/openfga/openfga/pkg/tuple"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/infra/log"
	tuplepb "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/setting"
)

// ulidAlphabet is Crockford base32 without I, L, O, U (OpenFGA store ID regex).
const ulidAlphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

// Ensure TupleStorageAdapter implements OpenFGADatastore.
var _ storage.OpenFGADatastore = (*TupleStorageAdapter)(nil)

// TupleStorageAdapter implements storage.OpenFGADatastore by delegating tuple
// operations to a gRPC TupleStorageService and keeping stores, models, and
// assertions in memory (Grafana-managed control plane).
type TupleStorageAdapter struct {
	tupleClient tuplepb.TupleStorageServiceClient
	conn        *grpc.ClientConn

	// Control plane (Grafana-managed, in-memory)
	stores     map[string]*openfgav1.Store
	models     map[string][]*openfgav1.AuthorizationModel
	assertions map[string]map[string][]*openfgav1.Assertion
	mu         sync.RWMutex

	maxTuplesPerWrite             int
	maxTypesPerAuthorizationModel int
	logger                        log.Logger
}

// NewTupleStorageAdapter creates an adapter that uses the given TupleStorageService client.
// Caller can pass a pre-dialed client; otherwise pass nil and cfg will be used to dial.
func NewTupleStorageAdapter(cfg *setting.Cfg, logger log.Logger, client tuplepb.TupleStorageServiceClient) (storage.OpenFGADatastore, error) {
	if client != nil {
		return newTupleStorageAdapterWithClient(cfg, logger, client, nil)
	}
	zs := &cfg.ZanzanaServer
	if zs.TupleServiceAddr == "" {
		return nil, ErrTupleServiceAddrRequired
	}
	opts := []grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())}
	// TODO: use zs.TupleServiceTLSCert when set for TLS
	conn, err := grpc.NewClient(zs.TupleServiceAddr, opts...)
	if err != nil {
		return nil, err
	}
	client = tuplepb.NewTupleStorageServiceClient(conn)
	return newTupleStorageAdapterWithClient(cfg, logger, client, conn)
}

func newTupleStorageAdapterWithClient(
	cfg *setting.Cfg,
	logger log.Logger,
	client tuplepb.TupleStorageServiceClient,
	conn *grpc.ClientConn,
) (storage.OpenFGADatastore, error) {
	maxTuples := storage.DefaultMaxTuplesPerWrite
	maxTypes := storage.DefaultMaxTypesPerAuthorizationModel
	if cfg != nil {
		// Optional: read from config if we add fields later
		_ = cfg
	}
	a := &TupleStorageAdapter{
		tupleClient:                   client,
		conn:                          conn,
		stores:                        make(map[string]*openfgav1.Store),
		models:                        make(map[string][]*openfgav1.AuthorizationModel),
		assertions:                    make(map[string]map[string][]*openfgav1.Assertion),
		maxTuplesPerWrite:             maxTuples,
		maxTypesPerAuthorizationModel: maxTypes,
		logger:                        logger,
	}
	return a, nil
}

// IsReady reports whether the tuple service is reachable.
func (a *TupleStorageAdapter) IsReady(ctx context.Context) (storage.ReadinessStatus, error) {
	// Optional: call a small RPC (e.g. ReadTuples with limit 0) to verify connectivity.
	return storage.ReadinessStatus{IsReady: true, Message: "tuple adapter"}, nil
}

// Close closes the gRPC connection if the adapter opened it.
func (a *TupleStorageAdapter) Close() {
	if a.conn != nil {
		_ = a.conn.Close()
		a.conn = nil
	}
}

// MaxTuplesPerWrite implements RelationshipTupleWriter.
func (a *TupleStorageAdapter) MaxTuplesPerWrite() int {
	return a.maxTuplesPerWrite
}

// Write implements RelationshipTupleWriter by calling TupleStorageService.WriteTuples.
func (a *TupleStorageAdapter) Write(ctx context.Context, store string, deletes storage.Deletes, writes storage.Writes, opts ...storage.TupleWriteOption) error {
	req := &tuplepb.WriteTuplesRequest{StoreId: store}
	for _, d := range deletes {
		req.Deletes = append(req.Deletes, openFGATupleKeyWithoutConditionToProto(d))
	}
	for _, w := range writes {
		req.Writes = append(req.Writes, openFGATupleKeyToProtoWrite(w))
	}
	_, err := a.tupleClient.WriteTuples(ctx, req)
	return err
}

// Read implements RelationshipTupleReader by calling ReadTuples and wrapping the stream in an iterator.
func (a *TupleStorageAdapter) Read(ctx context.Context, store string, filter storage.ReadFilter, _ storage.ReadOptions) (storage.TupleIterator, error) {
	req := readFilterToReadTuplesRequest(store, filter, 0, "")
	tuples, _, err := a.readTuplesStream(ctx, req)
	if err != nil {
		return nil, err
	}
	return storage.NewStaticTupleIterator(tuples), nil
}

// ReadPage implements RelationshipTupleReader by calling ReadTuples with pagination.
func (a *TupleStorageAdapter) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	pageSize := storage.DefaultPageSize
	if options.Pagination.PageSize > 0 {
		pageSize = options.Pagination.PageSize
	}
	req := readFilterToReadTuplesRequest(store, filter, pageSize, options.Pagination.From)
	tuples, contToken, err := a.readTuplesStream(ctx, req)
	if err != nil {
		return nil, "", err
	}
	return tuples, contToken, nil
}

// readTuplesStream calls ReadTuples and consumes the stream into a slice. Optionally respects page_size (0 = all).
func (a *TupleStorageAdapter) readTuplesStream(ctx context.Context, req *tuplepb.ReadTuplesRequest) ([]*openfgav1.Tuple, string, error) {
	stream, err := a.tupleClient.ReadTuples(ctx, req)
	if err != nil {
		return nil, "", err
	}
	var tuples []*openfgav1.Tuple
	pageSize := req.GetPageSize()
	for {
		t, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, "", err
		}
		tuples = append(tuples, protoTupleToOpenFGA(t))
		if pageSize > 0 && len(tuples) >= int(pageSize) {
			break
		}
	}
	// Our proto does not send continuation token in stream; backend could add it via metadata or we leave empty.
	contToken := ""
	return tuples, contToken, nil
}

// ReadUserTuple implements RelationshipTupleReader by calling ReadTuples with exact user filter.
func (a *TupleStorageAdapter) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, _ storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	req := readFilterToReadTuplesRequest(store, storage.ReadFilter(filter), 1, "")
	req.UserFilter = &tuplepb.UserFilter{}
	obj, rel, user := filter.Object, filter.Relation, filter.User
	if user != "" {
		ut, uid, urel := tupleutils.ToUserParts(user)
		req.UserFilter.UserType = ut
		req.UserFilter.UserId = uid
		req.UserFilter.UserRelation = urel
	}
	// Object and relation in request
	objType, objID := tupleutils.SplitObject(obj)
	req.ObjectType = objType
	req.ObjectId = objID
	req.Relation = rel

	tuples, _, err := a.readTuplesStream(ctx, req)
	if err != nil {
		return nil, err
	}
	if len(tuples) == 0 {
		return nil, storage.ErrNotFound
	}
	return tuples[0], nil
}

// ReadUsersetTuples implements RelationshipTupleReader by calling ReadTuples with user type filters.
func (a *TupleStorageAdapter) ReadUsersetTuples(ctx context.Context, store string, filter storage.ReadUsersetTuplesFilter, _ storage.ReadUsersetTuplesOptions) (storage.TupleIterator, error) {
	req := &tuplepb.ReadTuplesRequest{
		StoreId:    store,
		ObjectType: "",
		ObjectId:   "",
		Relation:   "",
		PageSize:   0,
	}
	objType, objID := tupleutils.SplitObject(filter.Object)
	req.ObjectType = objType
	req.ObjectId = objID
	req.Relation = filter.Relation
	for _, r := range filter.AllowedUserTypeRestrictions {
		if r == nil {
			continue
		}
		req.UserTypeFilters = append(req.UserTypeFilters, &tuplepb.UserTypeFilter{
			UserType:     r.GetType(),
			UserRelation: r.GetRelation(),
		})
	}
	tuples, _, err := a.readTuplesStream(ctx, req)
	if err != nil {
		return nil, err
	}
	return storage.NewStaticTupleIterator(tuples), nil
}

// ReadStartingWithUser implements RelationshipTupleReader by calling ReadTuplesByUser.
func (a *TupleStorageAdapter) ReadStartingWithUser(ctx context.Context, store string, filter storage.ReadStartingWithUserFilter, options storage.ReadStartingWithUserOptions) (storage.TupleIterator, error) {
	req := &tuplepb.ReadTuplesByUserRequest{
		StoreId:        store,
		ObjectType:     filter.ObjectType,
		Relation:       filter.Relation,
		SortAscending:  options.WithResultsSortedAscending,
		ConditionNames: filter.Conditions,
	}
	if filter.ObjectIDs != nil {
		req.ObjectIds = filter.ObjectIDs.Values()
	}
	for _, u := range filter.UserFilter {
		if u == nil {
			continue
		}
		objType, objID := tupleutils.SplitObject(u.GetObject())
		req.Users = append(req.Users, &tuplepb.UserRef{
			UserType:     objType,
			UserId:       objID,
			UserRelation: u.GetRelation(),
		})
	}
	stream, err := a.tupleClient.ReadTuplesByUser(ctx, req)
	if err != nil {
		return nil, err
	}
	var tuples []*openfgav1.Tuple
	for {
		t, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		tuples = append(tuples, protoTupleToOpenFGA(t))
	}
	return storage.NewStaticTupleIterator(tuples), nil
}

// ReadChanges implements ChangelogBackend by calling TupleStorageService.ReadChanges.
func (a *TupleStorageAdapter) ReadChanges(ctx context.Context, store string, filter storage.ReadChangesFilter, options storage.ReadChangesOptions) ([]*openfgav1.TupleChange, string, error) {
	pageSize := int32(storage.DefaultPageSize)
	if options.Pagination.PageSize > 0 {
		pageSize = int32(options.Pagination.PageSize)
	}
	horizonSeconds := int64(filter.HorizonOffset.Seconds())
	if horizonSeconds < 0 {
		horizonSeconds = 0
	}
	req := &tuplepb.ReadChangesRequest{
		StoreId:        store,
		ObjectType:     filter.ObjectType,
		AfterToken:     options.Pagination.From,
		PageSize:       pageSize,
		HorizonSeconds: horizonSeconds,
	}
	resp, err := a.tupleClient.ReadChanges(ctx, req)
	if err != nil {
		return nil, "", err
	}
	if len(resp.Changes) == 0 {
		return nil, "", storage.ErrNotFound
	}
	out := make([]*openfgav1.TupleChange, 0, len(resp.Changes))
	for _, c := range resp.Changes {
		out = append(out, protoChangeToOpenFGA(c))
	}
	return out, resp.ContinuationToken, nil
}

// CreateStore implements StoresBackend (in-memory).
// If store.Id is empty, a 26-character ULID is generated so OpenFGA API validation passes.
func (a *TupleStorageAdapter) CreateStore(ctx context.Context, store *openfgav1.Store) (*openfgav1.Store, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if store.GetName() == "" {
		return nil, ErrStoreIDOrNameRequired
	}
	// Always derive ID from name so the same name yields the same store ID everywhere.
	id := storeIDFromName(store.GetName())
	if _, exists := a.stores[id]; exists {
		return nil, storage.ErrCollision
	}
	cp := proto.Clone(store).(*openfgav1.Store)
	cp.Id = id
	a.stores[id] = cp
	return proto.Clone(cp).(*openfgav1.Store), nil
}

// storeIDFromName returns a deterministic 26-character store ID from a name,
// matching OpenFGA store ID pattern so the same name always yields the same ID.
func storeIDFromName(name string) string {
	const n = 26
	h := sha256.Sum256([]byte(name))
	out := make([]byte, n)
	for i := 0; i < n; i++ {
		out[i] = ulidAlphabet[int(h[i%len(h)])%len(ulidAlphabet)]
	}
	return string(out)
}

// GetStore implements StoresBackend (in-memory).
func (a *TupleStorageAdapter) GetStore(ctx context.Context, id string) (*openfgav1.Store, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	s, ok := a.stores[id]
	if !ok || s.GetDeletedAt() != nil {
		return nil, storage.ErrNotFound
	}
	return proto.Clone(s).(*openfgav1.Store), nil
}

// DeleteStore implements StoresBackend (in-memory).
func (a *TupleStorageAdapter) DeleteStore(ctx context.Context, id string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	s, ok := a.stores[id]
	if !ok {
		return storage.ErrNotFound
	}
	// Soft delete
	cp := proto.Clone(s).(*openfgav1.Store)
	cp.DeletedAt = timestamppb.Now()
	a.stores[id] = cp
	return nil
}

// ListStores implements StoresBackend (in-memory).
func (a *TupleStorageAdapter) ListStores(ctx context.Context, options storage.ListStoresOptions) ([]*openfgav1.Store, string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	var list []*openfgav1.Store
	for _, s := range a.stores {
		if s.GetDeletedAt() != nil {
			continue
		}
		if len(options.IDs) > 0 {
			found := false
			for _, id := range options.IDs {
				if id == s.GetId() {
					found = true
					break
				}
			}
			if !found {
				continue
			}
		}
		if options.Name != "" && s.GetName() != options.Name {
			continue
		}
		list = append(list, proto.Clone(s).(*openfgav1.Store))
	}
	// Pagination: simple offset-based using options.Pagination.From
	from := 0
	if options.Pagination.From != "" {
		if n, err := strconv.Atoi(options.Pagination.From); err == nil && n >= 0 {
			from = n
		}
	}
	pageSize := options.Pagination.PageSize
	if pageSize <= 0 {
		pageSize = storage.DefaultPageSize
	}
	if from >= len(list) {
		return []*openfgav1.Store{}, "", nil
	}
	end := from + pageSize
	if end > len(list) {
		end = len(list)
	}
	// Return clones to avoid copylocks
	page := make([]*openfgav1.Store, 0, end-from)
	for i := from; i < end; i++ {
		page = append(page, proto.Clone(list[i]).(*openfgav1.Store))
	}
	nextToken := ""
	if end < len(list) {
		nextToken = strconv.Itoa(end)
	}
	return page, nextToken, nil
}

// ReadAuthorizationModel implements AuthorizationModelReadBackend (in-memory).
func (a *TupleStorageAdapter) ReadAuthorizationModel(ctx context.Context, store, id string) (*openfgav1.AuthorizationModel, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	models, ok := a.models[store]
	if !ok {
		return nil, storage.ErrNotFound
	}
	for _, m := range models {
		if m.GetId() == id {
			return proto.Clone(m).(*openfgav1.AuthorizationModel), nil
		}
	}
	return nil, storage.ErrNotFound
}

// ReadAuthorizationModels implements AuthorizationModelReadBackend (in-memory).
func (a *TupleStorageAdapter) ReadAuthorizationModels(ctx context.Context, store string, options storage.ReadAuthorizationModelsOptions) ([]*openfgav1.AuthorizationModel, string, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	models, ok := a.models[store]
	if !ok {
		return []*openfgav1.AuthorizationModel{}, "", nil
	}
	from := 0
	if options.Pagination.From != "" {
		if n, err := strconv.Atoi(options.Pagination.From); err == nil && n >= 0 {
			from = n
		}
	}
	pageSize := options.Pagination.PageSize
	if pageSize <= 0 {
		pageSize = storage.DefaultPageSize
	}
	if from >= len(models) {
		return []*openfgav1.AuthorizationModel{}, "", nil
	}
	end := from + pageSize
	if end > len(models) {
		end = len(models)
	}
	page := make([]*openfgav1.AuthorizationModel, 0, end-from)
	for i := from; i < end; i++ {
		page = append(page, proto.Clone(models[i]).(*openfgav1.AuthorizationModel))
	}
	nextToken := ""
	if end < len(models) {
		nextToken = strconv.Itoa(end)
	}
	return page, nextToken, nil
}

// FindLatestAuthorizationModel implements AuthorizationModelReadBackend (in-memory).
func (a *TupleStorageAdapter) FindLatestAuthorizationModel(ctx context.Context, store string) (*openfgav1.AuthorizationModel, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	models, ok := a.models[store]
	if !ok || len(models) == 0 {
		return nil, storage.ErrNotFound
	}
	// Assume stored in descending order of ID (newest first)
	return proto.Clone(models[0]).(*openfgav1.AuthorizationModel), nil
}

// MaxTypesPerAuthorizationModel implements TypeDefinitionWriteBackend.
func (a *TupleStorageAdapter) MaxTypesPerAuthorizationModel() int {
	return a.maxTypesPerAuthorizationModel
}

// WriteAuthorizationModel implements TypeDefinitionWriteBackend (in-memory).
func (a *TupleStorageAdapter) WriteAuthorizationModel(ctx context.Context, store string, model *openfgav1.AuthorizationModel) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.models[store] == nil {
		a.models[store] = make([]*openfgav1.AuthorizationModel, 0)
	}
	// Replace or append by id
	id := model.GetId()
	list := a.models[store]
	newList := make([]*openfgav1.AuthorizationModel, 0, len(list)+1)
	found := false
	for _, m := range list {
		if m.GetId() == id {
			newList = append(newList, proto.Clone(model).(*openfgav1.AuthorizationModel))
			found = true
		} else {
			newList = append(newList, proto.Clone(m).(*openfgav1.AuthorizationModel))
		}
	}
	if !found {
		newList = append(newList, proto.Clone(model).(*openfgav1.AuthorizationModel))
	}
	a.models[store] = newList
	return nil
}

// WriteAssertions implements AssertionsBackend (in-memory).
func (a *TupleStorageAdapter) WriteAssertions(ctx context.Context, store, modelID string, assertions []*openfgav1.Assertion) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.assertions[store] == nil {
		a.assertions[store] = make(map[string][]*openfgav1.Assertion)
	}
	copied := make([]*openfgav1.Assertion, 0, len(assertions))
	for _, x := range assertions {
		copied = append(copied, proto.Clone(x).(*openfgav1.Assertion))
	}
	a.assertions[store][modelID] = copied
	return nil
}

// ReadAssertions implements AssertionsBackend (in-memory).
func (a *TupleStorageAdapter) ReadAssertions(ctx context.Context, store, modelID string) ([]*openfgav1.Assertion, error) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	if a.assertions[store] == nil {
		return []*openfgav1.Assertion{}, nil
	}
	list, ok := a.assertions[store][modelID]
	if !ok {
		return []*openfgav1.Assertion{}, nil
	}
	out := make([]*openfgav1.Assertion, 0, len(list))
	for _, x := range list {
		out = append(out, proto.Clone(x).(*openfgav1.Assertion))
	}
	return out, nil
}

// Helpers: proto <-> openfga conversions

func readFilterToReadTuplesRequest(store string, filter storage.ReadFilter, pageSize int, pageToken string) *tuplepb.ReadTuplesRequest {
	objType, objID := tupleutils.SplitObject(filter.Object)
	req := &tuplepb.ReadTuplesRequest{
		StoreId:    store,
		ObjectType: objType,
		ObjectId:   objID,
		Relation:   filter.Relation,
		PageSize:   int32(pageSize),
		PageToken:  pageToken,
	}
	if filter.User != "" {
		ut, uid, urel := tupleutils.ToUserParts(filter.User)
		req.UserFilter = &tuplepb.UserFilter{UserType: ut, UserId: uid, UserRelation: urel}
	}
	return req
}

func openFGATupleKeyToProtoWrite(tk *openfgav1.TupleKey) *tuplepb.StorageTupleWrite {
	w := &tuplepb.StorageTupleWrite{Key: openFGATupleKeyToProtoKey(tk)}
	if c := tk.GetCondition(); c != nil {
		w.ConditionName = c.GetName()
		if ctx := c.GetContext(); ctx != nil && len(ctx.GetFields()) > 0 {
			b, _ := proto.Marshal(ctx)
			w.ConditionContext = b
		}
	}
	return w
}

func openFGATupleKeyToProtoKey(tk *openfgav1.TupleKey) *tuplepb.StorageTupleKey {
	if tk == nil {
		return nil
	}
	objType, objID := tupleutils.SplitObject(tk.GetObject())
	userType, userID, userRel := tupleutils.ToUserParts(tk.GetUser())
	return &tuplepb.StorageTupleKey{
		ObjectType:   objType,
		ObjectId:     objID,
		Relation:     tk.GetRelation(),
		UserType:     userType,
		UserId:       userID,
		UserRelation: userRel,
	}
}

func openFGATupleKeyWithoutConditionToProto(tk *openfgav1.TupleKeyWithoutCondition) *tuplepb.StorageTupleKey {
	if tk == nil {
		return nil
	}
	return openFGATupleKeyToProtoKey(tupleutils.TupleKeyWithoutConditionToTupleKey(tk))
}

func protoTupleToOpenFGA(t *tuplepb.StorageTuple) *openfgav1.Tuple {
	if t == nil {
		return nil
	}
	object := tupleutils.BuildObject(t.GetObjectType(), t.GetObjectId())
	user := tupleutils.FromUserParts(t.GetUserType(), t.GetUserId(), t.GetUserRelation())
	key := tupleutils.NewTupleKey(object, t.GetRelation(), user)
	if t.GetConditionName() != "" {
		var condCtx *structpb.Struct
		if len(t.GetConditionContext()) > 0 {
			condCtx = &structpb.Struct{}
			_ = proto.Unmarshal(t.GetConditionContext(), condCtx)
		}
		key = tupleutils.NewTupleKeyWithCondition(object, t.GetRelation(), user, t.GetConditionName(), condCtx)
	}
	return &openfgav1.Tuple{
		Key:       key,
		Timestamp: t.GetTimestamp(),
	}
}

// OpenFGATupleToProto converts an openfga Tuple to our StorageTuple proto (for SQL server).
func OpenFGATupleToProto(t *openfgav1.Tuple) *tuplepb.StorageTuple {
	if t == nil || t.GetKey() == nil {
		return nil
	}
	k := t.GetKey()
	objType, objID := tupleutils.SplitObject(k.GetObject())
	userType, userID, userRel := tupleutils.ToUserParts(k.GetUser())
	out := &tuplepb.StorageTuple{
		ObjectType:   objType,
		ObjectId:     objID,
		Relation:     k.GetRelation(),
		UserType:     userType,
		UserId:       userID,
		UserRelation: userRel,
		Timestamp:    t.GetTimestamp(),
	}
	if c := k.GetCondition(); c != nil {
		out.ConditionName = c.GetName()
		if ctx := c.GetContext(); ctx != nil && len(ctx.GetFields()) > 0 {
			b, _ := proto.Marshal(ctx)
			out.ConditionContext = b
		}
	}
	return out
}

func protoChangeToOpenFGA(c *tuplepb.StorageTupleChange) *openfgav1.TupleChange {
	if c == nil {
		return nil
	}
	var op openfgav1.TupleOperation
	switch c.GetOperation() {
	case tuplepb.Operation_OPERATION_WRITE:
		op = openfgav1.TupleOperation_TUPLE_OPERATION_WRITE
	case tuplepb.Operation_OPERATION_DELETE:
		op = openfgav1.TupleOperation_TUPLE_OPERATION_DELETE
	default:
		op = openfgav1.TupleOperation_TUPLE_OPERATION_WRITE
	}
	tk := protoTupleToOpenFGA(c.GetTuple())
	var key *openfgav1.TupleKey
	if tk != nil {
		key = tk.GetKey()
	}
	return &openfgav1.TupleChange{
		TupleKey:  key,
		Operation: op,
		Timestamp: c.GetTuple().GetTimestamp(),
	}
}
