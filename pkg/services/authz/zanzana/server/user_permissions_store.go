package server

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/memory"
	"github.com/openfga/openfga/pkg/tuple"
	"google.golang.org/protobuf/proto"
)

// The evaluator only reads this request's graph. Building indexes directly avoids
// the quadratic duplicate detection and full scans in the general memory backend.
type permissionSnapshotStore struct {
	storage.OpenFGADatastore
	storeID  string
	all      []*openfgav1.Tuple
	exact    map[[3]string]*openfgav1.Tuple
	byObject map[string][]*openfgav1.Tuple
	byType   map[string][]*openfgav1.Tuple
	byUser   map[string][]*openfgav1.Tuple
	reverse  map[[3]string][]*openfgav1.Tuple
}

func newPermissionSnapshotStore(ctx context.Context, storeID string, model *openfgav1.AuthorizationModel, keys []*openfgav1.TupleKey) (storage.OpenFGADatastore, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	s := &permissionSnapshotStore{
		OpenFGADatastore: memory.New(), storeID: storeID,
		all: make([]*openfgav1.Tuple, 0, len(keys)), exact: make(map[[3]string]*openfgav1.Tuple, len(keys)),
		byObject: make(map[string][]*openfgav1.Tuple), byType: make(map[string][]*openfgav1.Tuple),
		byUser: make(map[string][]*openfgav1.Tuple), reverse: make(map[[3]string][]*openfgav1.Tuple),
	}
	if err := s.WriteAuthorizationModel(ctx, storeID, model); err != nil {
		s.Close()
		return nil, err
	}
	for _, key := range keys {
		if err := ctx.Err(); err != nil {
			s.Close()
			return nil, err
		}
		if key == nil {
			s.Close()
			return nil, errors.New("nil tuple in permission snapshot")
		}
		id := [3]string{key.GetObject(), key.GetRelation(), key.GetUser()}
		if _, exists := s.exact[id]; exists {
			s.Close()
			return nil, storage.ErrInvalidWriteInput
		}
		t := &openfgav1.Tuple{Key: proto.Clone(key).(*openfgav1.TupleKey)}
		objectType := tuple.GetType(key.GetObject())
		s.all = append(s.all, t)
		s.exact[id] = t
		s.byObject[key.GetObject()] = append(s.byObject[key.GetObject()], t)
		s.byType[objectType] = append(s.byType[objectType], t)
		s.byUser[key.GetUser()] = append(s.byUser[key.GetUser()], t)
		reverseKey := [3]string{objectType, key.GetRelation(), key.GetUser()}
		s.reverse[reverseKey] = append(s.reverse[reverseKey], t)
	}
	return s, nil
}

func (s *permissionSnapshotStore) Write(context.Context, string, storage.Deletes, storage.Writes, ...storage.TupleWriteOption) error {
	return errors.New("permission snapshot tuples are read-only")
}

func snapshotConditionMatches(key *openfgav1.TupleKey, conditions []string) bool {
	return len(conditions) == 0 || slices.Contains(conditions, key.GetCondition().GetName())
}

func (s *permissionSnapshotStore) matching(ctx context.Context, store string, filter storage.ReadFilter) ([]*openfgav1.Tuple, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if store != s.storeID {
		return nil, nil
	}
	candidates := s.all
	objectType, objectID := tuple.SplitObject(filter.Object)
	if filter.Object != "" {
		candidates = s.byObject[filter.Object]
		if objectID == "" {
			candidates = s.byType[objectType]
		}
	}
	userType, userID, _ := tuple.ToUserParts(filter.User)
	if filter.User != "" && userID != "" && len(s.byUser[filter.User]) < len(candidates) {
		candidates = s.byUser[filter.User]
	}
	var matches []*openfgav1.Tuple
	for _, t := range candidates {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		key := t.GetKey()
		if filter.Object != "" && ((objectID != "" && key.GetObject() != filter.Object) || (objectID == "" && tuple.GetType(key.GetObject()) != objectType)) {
			continue
		}
		if filter.Relation != "" && key.GetRelation() != filter.Relation {
			continue
		}
		if filter.User != "" && ((userID != "" && key.GetUser() != filter.User) || (userID == "" && !strings.HasPrefix(key.GetUser(), userType+":"))) {
			continue
		}
		if snapshotConditionMatches(key, filter.Conditions) {
			matches = append(matches, t)
		}
	}
	return matches, nil
}

func (s *permissionSnapshotStore) Read(ctx context.Context, store string, filter storage.ReadFilter, _ storage.ReadOptions) (storage.TupleIterator, error) {
	matches, err := s.matching(ctx, store, filter)
	if err != nil {
		return nil, err
	}
	return snapshotTupleIterator(matches, false), nil
}

func (s *permissionSnapshotStore) ReadPage(ctx context.Context, store string, filter storage.ReadFilter, options storage.ReadPageOptions) ([]*openfgav1.Tuple, string, error) {
	matches, err := s.matching(ctx, store, filter)
	if err != nil {
		return nil, "", err
	}
	start := 0
	if options.Pagination.From != "" {
		start, err = strconv.Atoi(options.Pagination.From)
		if err != nil || start < 0 || start > len(matches) {
			return nil, "", storage.ErrInvalidContinuationToken
		}
	}
	end := len(matches)
	if size := options.Pagination.PageSize; size > 0 && size < end-start {
		end = start + size
		return matches[start:end], strconv.Itoa(end), nil
	}
	return matches[start:end], "", nil
}

func (s *permissionSnapshotStore) ReadUserTuple(ctx context.Context, store string, filter storage.ReadUserTupleFilter, _ storage.ReadUserTupleOptions) (*openfgav1.Tuple, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	t := s.exact[[3]string{filter.Object, filter.Relation, filter.User}]
	if store != s.storeID || t == nil || !snapshotConditionMatches(t.GetKey(), filter.Conditions) {
		return nil, storage.ErrNotFound
	}
	return t, nil
}

func (s *permissionSnapshotStore) ReadUsersetTuples(ctx context.Context, store string, filter storage.ReadUsersetTuplesFilter, _ storage.ReadUsersetTuplesOptions) (storage.TupleIterator, error) {
	candidates, err := s.matching(ctx, store, storage.ReadFilter{Object: filter.Object, Relation: filter.Relation, Conditions: filter.Conditions})
	if err != nil {
		return nil, err
	}
	var matches []*openfgav1.Tuple
	for _, t := range candidates {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		user := t.GetKey().GetUser()
		if tuple.GetUserTypeFromUser(user) != tuple.UserSet {
			continue
		}
		if len(filter.AllowedUserTypeRestrictions) == 0 {
			matches = append(matches, t)
			continue
		}
		userType, userID, relation := tuple.ToUserParts(user)
		for _, allowed := range filter.AllowedUserTypeRestrictions {
			if allowed.GetType() == userType && ((allowed.GetWildcard() != nil && userID == "*") || (allowed.GetRelation() != "" && allowed.GetRelation() == relation)) {
				matches = append(matches, t)
				break
			}
		}
	}
	return snapshotTupleIterator(matches, false), nil
}

func (s *permissionSnapshotStore) ReadStartingWithUser(ctx context.Context, store string, filter storage.ReadStartingWithUserFilter, options storage.ReadStartingWithUserOptions) (storage.TupleIterator, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var matches []*openfgav1.Tuple
	if store == s.storeID {
		seen := make(map[string]struct{}, len(filter.UserFilter))
		for _, user := range filter.UserFilter {
			principal := tuple.GetObjectRelationAsString(user)
			if _, exists := seen[principal]; exists {
				continue
			}
			seen[principal] = struct{}{}
			for _, t := range s.reverse[[3]string{filter.ObjectType, filter.Relation, principal}] {
				if err := ctx.Err(); err != nil {
					return nil, err
				}
				key := t.GetKey()
				_, objectID := tuple.SplitObject(key.GetObject())
				if (filter.ObjectIDs == nil || filter.ObjectIDs.Exists(objectID)) && snapshotConditionMatches(key, filter.Conditions) {
					matches = append(matches, t)
				}
			}
		}
	}
	if options.WithResultsSortedAscending {
		slices.SortFunc(matches, func(a, b *openfgav1.Tuple) int {
			return strings.Compare(a.GetKey().GetObject(), b.GetKey().GetObject())
		})
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	return snapshotTupleIterator(matches, options.WithResultsSortedAscending), nil
}

type permissionSnapshotIterator struct {
	storage.TupleIterator
	ordered bool
}

func (i permissionSnapshotIterator) IsOrdered() bool { return i.ordered }

func snapshotTupleIterator(tuples []*openfgav1.Tuple, ordered bool) storage.TupleIterator {
	// StaticTupleIterator assumes sorted input; most snapshot reads have no order.
	return permissionSnapshotIterator{TupleIterator: storage.NewStaticTupleIterator(tuples), ordered: ordered}
}
