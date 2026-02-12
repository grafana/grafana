package store

import (
	"context"
	"fmt"
	"time"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	tupleutils "github.com/openfga/openfga/pkg/tuple"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/grafana/grafana/pkg/infra/log"
	tuplepb "github.com/grafana/grafana/pkg/services/authz/proto/v1"
)

// TupleStorageSQLServer implements TupleStorageService by delegating to an OpenFGA SQL datastore.
// It serves as a reference implementation and can be used for integration tests.
type TupleStorageSQLServer struct {
	tuplepb.UnimplementedTupleStorageServiceServer
	ds     storage.OpenFGADatastore
	logger log.Logger
}

// NewTupleStorageSQLServer returns a TupleStorageService server that uses the given datastore.
// If logger is non-nil, debug logging of incoming requests is enabled.
func NewTupleStorageSQLServer(ds storage.OpenFGADatastore, logger log.Logger) *TupleStorageSQLServer {
	return &TupleStorageSQLServer{ds: ds, logger: logger}
}

// WriteTuples implements TupleStorageServiceServer.
func (s *TupleStorageSQLServer) WriteTuples(ctx context.Context, req *tuplepb.WriteTuplesRequest) (*tuplepb.WriteTuplesResponse, error) {
	s.logRequest("WriteTuples", "store_id", req.GetStoreId(), "writes", len(req.GetWrites()), "deletes", len(req.GetDeletes()))
	deletes := make(storage.Deletes, 0, len(req.GetDeletes()))
	for _, d := range req.GetDeletes() {
		deletes = append(deletes, protoKeyToOpenFGATupleKeyWithoutCondition(d))
	}
	writes := make(storage.Writes, 0, len(req.GetWrites()))
	for _, w := range req.GetWrites() {
		writes = append(writes, protoWriteToOpenFGATupleKey(w))
	}
	if err := s.ds.Write(ctx, req.GetStoreId(), deletes, writes); err != nil {
		return nil, err
	}
	return &tuplepb.WriteTuplesResponse{}, nil
}

// ReadTuples implements TupleStorageServiceServer by streaming tuples from the datastore.
func (s *TupleStorageSQLServer) ReadTuples(req *tuplepb.ReadTuplesRequest, stream tuplepb.TupleStorageService_ReadTuplesServer) error {
	s.logRequest("ReadTuples", "store_id", req.GetStoreId(), "object_type", req.GetObjectType(), "object_id", req.GetObjectId(),
		"relation", req.GetRelation(), "page_size", req.GetPageSize(), "page_token", req.GetPageToken(),
		"user_filter", userFilterSummary(req.GetUserFilter()), "user_type_filters", len(req.GetUserTypeFilters()))
	ctx := stream.Context()
	filter := storage.ReadFilter{
		Object:   tupleutils.BuildObject(req.GetObjectType(), req.GetObjectId()),
		Relation: req.GetRelation(),
		User:     "",
	}
	if uf := req.GetUserFilter(); uf != nil {
		filter.User = tupleutils.FromUserParts(uf.GetUserType(), uf.GetUserId(), uf.GetUserRelation())
	}
	opts := storage.ReadPageOptions{}
	if req.GetPageSize() > 0 {
		opts.Pagination = storage.PaginationOptions{PageSize: int(req.GetPageSize()), From: req.GetPageToken()}
	}
	tuples, _, err := s.ds.ReadPage(ctx, req.GetStoreId(), filter, opts)
	if err != nil {
		return err
	}
	for _, t := range tuples {
		if err := stream.Send(OpenFGATupleToProto(t)); err != nil {
			return err
		}
	}
	return nil
}

// ReadTuplesByUser implements TupleStorageServiceServer by streaming tuples from the datastore.
func (s *TupleStorageSQLServer) ReadTuplesByUser(req *tuplepb.ReadTuplesByUserRequest, stream tuplepb.TupleStorageService_ReadTuplesByUserServer) error {
	s.logRequest("ReadTuplesByUser", "store_id", req.GetStoreId(), "object_type", req.GetObjectType(), "relation", req.GetRelation(),
		"users", len(req.GetUsers()), "object_ids", len(req.GetObjectIds()), "sort_ascending", req.GetSortAscending())
	ctx := stream.Context()
	userFilter := make([]*openfgav1.ObjectRelation, 0, len(req.GetUsers()))
	for _, u := range req.GetUsers() {
		userFilter = append(userFilter, &openfgav1.ObjectRelation{
			Object:   tupleutils.FromUserParts(u.GetUserType(), u.GetUserId(), u.GetUserRelation()),
			Relation: u.GetUserRelation(),
		})
	}
	var objectIDs storage.SortedSet
	if len(req.GetObjectIds()) > 0 {
		objectIDs = storage.NewSortedSet(req.GetObjectIds()...)
	}
	filter := storage.ReadStartingWithUserFilter{
		ObjectType: req.GetObjectType(),
		Relation:   req.GetRelation(),
		UserFilter: userFilter,
		ObjectIDs:  objectIDs,
		Conditions: req.GetConditionNames(),
	}
	opts := storage.ReadStartingWithUserOptions{WithResultsSortedAscending: req.GetSortAscending()}
	it, err := s.ds.ReadStartingWithUser(ctx, req.GetStoreId(), filter, opts)
	if err != nil {
		return err
	}
	defer it.Stop()
	for {
		t, err := it.Next(ctx)
		if err == storage.ErrIteratorDone {
			break
		}
		if err != nil {
			return err
		}
		if err := stream.Send(OpenFGATupleToProto(t)); err != nil {
			return err
		}
	}
	return nil
}

// ReadChanges implements TupleStorageServiceServer.
func (s *TupleStorageSQLServer) ReadChanges(ctx context.Context, req *tuplepb.ReadChangesRequest) (*tuplepb.ReadChangesResponse, error) {
	s.logRequest("ReadChanges", "store_id", req.GetStoreId(), "object_type", req.GetObjectType(),
		"after_token", req.GetAfterToken(), "page_size", req.GetPageSize(), "horizon_seconds", req.GetHorizonSeconds())
	horizon := time.Duration(req.GetHorizonSeconds()) * time.Second
	if horizon < 0 {
		horizon = 0
	}
	filter := storage.ReadChangesFilter{
		ObjectType:    req.GetObjectType(),
		HorizonOffset: horizon,
	}
	opts := storage.ReadChangesOptions{
		Pagination: storage.PaginationOptions{PageSize: int(req.GetPageSize()), From: req.GetAfterToken()},
		SortDesc:   true,
	}
	changes, contToken, err := s.ds.ReadChanges(ctx, req.GetStoreId(), filter, opts)
	if err != nil {
		if err == storage.ErrNotFound {
			return &tuplepb.ReadChangesResponse{Changes: nil, ContinuationToken: ""}, nil
		}
		return nil, err
	}
	out := make([]*tuplepb.StorageTupleChange, 0, len(changes))
	for _, c := range changes {
		out = append(out, openFGAChangeToProto(c))
	}
	return &tuplepb.ReadChangesResponse{Changes: out, ContinuationToken: contToken}, nil
}

func (s *TupleStorageSQLServer) logRequest(method string, keyValues ...any) {
	if s.logger != nil {
		s.logger.Debug(fmt.Sprintf("TupleStorageSQLServer %s request", method), keyValues...)
	}
}

func userFilterSummary(uf *tuplepb.UserFilter) string {
	if uf == nil {
		return ""
	}
	return fmt.Sprintf("%s:%s#%s", uf.GetUserType(), uf.GetUserId(), uf.GetUserRelation())
}

func protoKeyToOpenFGATupleKeyWithoutCondition(k *tuplepb.StorageTupleKey) *openfgav1.TupleKeyWithoutCondition {
	if k == nil {
		return nil
	}
	return &openfgav1.TupleKeyWithoutCondition{
		Object:   tupleutils.BuildObject(k.GetObjectType(), k.GetObjectId()),
		Relation: k.GetRelation(),
		User:     tupleutils.FromUserParts(k.GetUserType(), k.GetUserId(), k.GetUserRelation()),
	}
}

func protoWriteToOpenFGATupleKey(w *tuplepb.StorageTupleWrite) *openfgav1.TupleKey {
	if w == nil || w.GetKey() == nil {
		return nil
	}
	k := w.GetKey()
	object := tupleutils.BuildObject(k.GetObjectType(), k.GetObjectId())
	user := tupleutils.FromUserParts(k.GetUserType(), k.GetUserId(), k.GetUserRelation())
	if w.GetConditionName() != "" {
		var condCtx *structpb.Struct
		if len(w.GetConditionContext()) > 0 {
			condCtx = &structpb.Struct{}
			_ = proto.Unmarshal(w.GetConditionContext(), condCtx)
		}
		return tupleutils.NewTupleKeyWithCondition(object, k.GetRelation(), user, w.GetConditionName(), condCtx)
	}
	return tupleutils.NewTupleKey(object, k.GetRelation(), user)
}

func openFGAChangeToProto(c *openfgav1.TupleChange) *tuplepb.StorageTupleChange {
	if c == nil {
		return nil
	}
	var op tuplepb.Operation
	switch c.GetOperation() {
	case openfgav1.TupleOperation_TUPLE_OPERATION_WRITE:
		op = tuplepb.Operation_OPERATION_WRITE
	case openfgav1.TupleOperation_TUPLE_OPERATION_DELETE:
		op = tuplepb.Operation_OPERATION_DELETE
	default:
		op = tuplepb.Operation_OPERATION_UNSPECIFIED
	}
	var tuple *tuplepb.StorageTuple
	if c.GetTupleKey() != nil {
		// TupleChange in openfga has TupleKey + Timestamp; we need a full tuple for our proto.
		tuple = OpenFGATupleKeyAndTimestampToProto(c.GetTupleKey(), c.GetTimestamp())
	}
	return &tuplepb.StorageTupleChange{Tuple: tuple, Operation: op, Ulid: ""}
}

// OpenFGATupleKeyAndTimestampToProto builds a StorageTuple from key and timestamp (for changelog).
func OpenFGATupleKeyAndTimestampToProto(k *openfgav1.TupleKey, ts *timestamppb.Timestamp) *tuplepb.StorageTuple {
	if k == nil {
		return nil
	}
	objType, objID := tupleutils.SplitObject(k.GetObject())
	userType, userID, userRel := tupleutils.ToUserParts(k.GetUser())
	out := &tuplepb.StorageTuple{
		ObjectType:   objType,
		ObjectId:     objID,
		Relation:     k.GetRelation(),
		UserType:     userType,
		UserId:       userID,
		UserRelation: userRel,
	}
	if ts != nil {
		out.Timestamp = ts
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
