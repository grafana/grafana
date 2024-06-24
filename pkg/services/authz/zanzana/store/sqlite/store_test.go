package sqlite

import (
	"context"
	"testing"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/oklog/ulid/v2"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"

	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/storage/sqlcommon"
	"github.com/openfga/openfga/pkg/storage/test"
	"github.com/openfga/openfga/pkg/tuple"
	"github.com/openfga/openfga/pkg/typesystem"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/store/textfixtures"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDatastore(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)
	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)
	test.RunAllTests(t, ds)
}

func TestIntegrationDatastoreAfterCloseIsNotReady(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ds.Close()
	status, err := ds.IsReady(context.Background())
	require.Error(t, err)
	require.False(t, status.IsReady)
}

// TestIntegrationReadEnsureNoOrder asserts that the read response is not ordered by ulid.
func TestIntegrationReadEnsureNoOrder(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ctx := context.Background()
	store := "store"
	firstTuple := tuple.NewTupleKey("doc:object_id_1", "relation", "user:user_1")
	secondTuple := tuple.NewTupleKey("doc:object_id_2", "relation", "user:user_2")

	err = sqlcommon.Write(ctx,
		sqlcommon.NewDBInfo(ds.db, ds.stbl, sq.Expr("datetime('subsec')")),
		store,
		[]*openfgav1.TupleKeyWithoutCondition{},
		[]*openfgav1.TupleKey{firstTuple},
		time.Now())
	require.NoError(t, err)

	// Tweak time so that ULID is smaller.
	err = sqlcommon.Write(ctx,
		sqlcommon.NewDBInfo(ds.db, ds.stbl, sq.Expr("datetime('subsec')")),
		store,
		[]*openfgav1.TupleKeyWithoutCondition{},
		[]*openfgav1.TupleKey{secondTuple},
		time.Now().Add(time.Minute*-1))
	require.NoError(t, err)

	iter, err := ds.Read(ctx,
		store,
		tuple.NewTupleKey("doc:", "relation", ""))
	defer iter.Stop()

	require.NoError(t, err)

	// We expect that objectID1 will return first because it is inserted first.
	curTuple, err := iter.Next(ctx)
	require.NoError(t, err)
	require.Equal(t, firstTuple, curTuple.GetKey())

	curTuple, err = iter.Next(ctx)
	require.NoError(t, err)
	require.Equal(t, secondTuple, curTuple.GetKey())
}

// TestIntegrationReadPageEnsureNoOrder asserts that the read page is ordered by ulid.
func TestIntegrationReadPageEnsureOrder(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ctx := context.Background()

	store := "store"
	firstTuple := tuple.NewTupleKey("doc:object_id_1", "relation", "user:user_1")
	secondTuple := tuple.NewTupleKey("doc:object_id_2", "relation", "user:user_2")

	err = sqlcommon.Write(ctx,
		sqlcommon.NewDBInfo(ds.db, ds.stbl, sq.Expr("datetime('subsec')")),
		store,
		[]*openfgav1.TupleKeyWithoutCondition{},
		[]*openfgav1.TupleKey{firstTuple},
		time.Now())
	require.NoError(t, err)

	// Tweak time so that ULID is smaller.
	err = sqlcommon.Write(ctx,
		sqlcommon.NewDBInfo(ds.db, ds.stbl, sq.Expr("datetime('subsec')")),
		store,
		[]*openfgav1.TupleKeyWithoutCondition{},
		[]*openfgav1.TupleKey{secondTuple},
		time.Now().Add(time.Minute*-1))
	require.NoError(t, err)

	tuples, _, err := ds.ReadPage(ctx,
		store,
		tuple.NewTupleKey("doc:", "relation", ""),
		storage.NewPaginationOptions(0, ""))
	require.NoError(t, err)

	require.Len(t, tuples, 2)
	// We expect that objectID2 will return first because it has a smaller ulid.
	require.Equal(t, secondTuple, tuples[0].GetKey())
	require.Equal(t, firstTuple, tuples[1].GetKey())
}

func TestIntegrationReadAuthorizationModelUnmarshallError(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ctx := context.Background()
	defer ds.Close()
	store := "store"
	modelID := "foo"
	schemaVersion := typesystem.SchemaVersion1_0

	bytes, err := proto.Marshal(&openfgav1.TypeDefinition{Type: "document"})
	require.NoError(t, err)
	pbdata := []byte{0x01, 0x02, 0x03}

	_, err = ds.db.ExecContext(ctx, "INSERT INTO authorization_model (store, authorization_model_id, schema_version, type, type_definition, serialized_protobuf) VALUES (?, ?, ?, ?, ?, ?)", store, modelID, schemaVersion, "document", bytes, pbdata)
	require.NoError(t, err)

	_, err = ds.ReadAuthorizationModel(ctx, store, modelID)
	require.Error(t, err)
	require.Contains(t, err.Error(), "cannot parse invalid wire-format data")
}

// TestIntegrationAllowNullCondition tests that tuple and changelog rows existing before
// migration 005_add_conditions_to_tuples can be successfully read.
func TestIntegrationAllowNullCondition(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ctx := context.Background()

	stmt := `
		INSERT INTO tuple (
			store, object_type, object_id, relation, _user, user_type, ulid,
			condition_name, condition_context, inserted_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('subsec'));
	`
	_, err = ds.db.ExecContext(
		ctx, stmt, "store", "folder", "2021-budget", "owner", "user:anne", "user",
		ulid.Make().String(), nil, nil,
	)
	require.NoError(t, err)

	tk := tuple.NewTupleKey("folder:2021-budget", "owner", "user:anne")
	iter, err := ds.Read(ctx, "store", tk)
	require.NoError(t, err)
	defer iter.Stop()

	curTuple, err := iter.Next(ctx)
	require.NoError(t, err)
	require.Equal(t, tk, curTuple.GetKey())

	tuples, _, err := ds.ReadPage(ctx, "store", &openfgav1.TupleKey{}, storage.PaginationOptions{
		PageSize: 2,
	})
	require.NoError(t, err)
	require.Len(t, tuples, 1)
	require.Equal(t, tk, tuples[0].GetKey())

	userTuple, err := ds.ReadUserTuple(ctx, "store", tk)
	require.NoError(t, err)
	require.Equal(t, tk, userTuple.GetKey())

	tk2 := tuple.NewTupleKey("folder:2022-budget", "viewer", "user:anne")
	_, err = ds.db.ExecContext(
		ctx, stmt, "store", "folder", "2022-budget", "viewer", "user:anne", "userset",
		ulid.Make().String(), nil, nil,
	)

	require.NoError(t, err)
	iter, err = ds.ReadUsersetTuples(ctx, "store", storage.ReadUsersetTuplesFilter{Object: "folder:2022-budget"})
	require.NoError(t, err)
	defer iter.Stop()

	curTuple, err = iter.Next(ctx)
	require.NoError(t, err)
	require.Equal(t, tk2, curTuple.GetKey())

	iter, err = ds.ReadStartingWithUser(ctx, "store", storage.ReadStartingWithUserFilter{
		ObjectType: "folder",
		Relation:   "owner",
		UserFilter: []*openfgav1.ObjectRelation{
			{Object: "user:anne"},
		},
	})
	require.NoError(t, err)
	defer iter.Stop()

	curTuple, err = iter.Next(ctx)
	require.NoError(t, err)
	require.Equal(t, tk, curTuple.GetKey())

	stmt = `
	INSERT INTO changelog (
		store, object_type, object_id, relation, _user, ulid,
		condition_name, condition_context, inserted_at, operation
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('subsec'), ?);
`
	_, err = ds.db.ExecContext(
		ctx, stmt, "store", "folder", "2021-budget", "owner", "user:anne",
		ulid.Make().String(), nil, nil, openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
	)
	require.NoError(t, err)

	_, err = ds.db.ExecContext(
		ctx, stmt, "store", "folder", "2021-budget", "owner", "user:anne",
		ulid.Make().String(), nil, nil, openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
	)
	require.NoError(t, err)

	changes, _, err := ds.ReadChanges(ctx, "store", "folder", storage.PaginationOptions{}, 0)
	require.NoError(t, err)
	require.Len(t, changes, 2)
	require.Equal(t, tk, changes[0].GetTupleKey())
	require.Equal(t, tk, changes[1].GetTupleKey())
}

// TestIntegrationMarshalledAssertions tests that previously persisted marshalled
// assertions can be read back. In any case where the Assertions proto model
// needs to change, we'll likely need to introduce a series of data migrations.
func TestIntegrationMarshalledAssertions(t *testing.T) {
	db := textfixtures.SQLiteIntegrationTest(t)

	ds, err := NewWithDB(db, sqlcommon.NewConfig())
	require.NoError(t, err)

	ctx := context.Background()
	// Note: this represents an assertion written on v1.3.7.
	stmt := `
		INSERT INTO assertion (
			store, authorization_model_id, assertions
		) VALUES (?, ?, UNHEX('0A2B0A270A12666F6C6465723A323032312D62756467657412056F776E65721A0A757365723A616E6E657A1001'));
	`
	_, err = ds.db.ExecContext(ctx, stmt, "store", "model")
	require.NoError(t, err)

	assertions, err := ds.ReadAssertions(ctx, "store", "model")
	require.NoError(t, err)

	expectedAssertions := []*openfgav1.Assertion{
		{
			TupleKey: &openfgav1.AssertionTupleKey{
				Object:   "folder:2021-budget",
				Relation: "owner",
				User:     "user:annez",
			},
			Expectation: true,
		},
	}
	require.Equal(t, expectedAssertions, assertions)
}
