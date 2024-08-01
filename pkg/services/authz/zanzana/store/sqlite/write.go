package sqlite

import (
	"context"
	"database/sql"
	"time"

	sq "github.com/Masterminds/squirrel"
	"github.com/oklog/ulid/v2"
	"google.golang.org/protobuf/proto"

	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/openfga/openfga/pkg/storage"
	tupleUtils "github.com/openfga/openfga/pkg/tuple"
)

// write is copied from https://github.com/openfga/openfga/blob/main/pkg/storage/sqlcommon/sqlcommon.go#L330-L456
// but uses custom handleSQLError.
func write(
	ctx context.Context,
	db *sql.DB,
	stbl sq.StatementBuilderType,
	sqlTime any,
	store string,
	deletes storage.Deletes,
	writes storage.Writes,
	now time.Time,
) error {
	txn, err := db.BeginTx(ctx, nil)
	if err != nil {
		return handleSQLError(err)
	}
	defer func() {
		_ = txn.Rollback()
	}()

	changelogBuilder := stbl.
		Insert("changelog").
		Columns(
			"store", "object_type", "object_id", "relation", "_user",
			"condition_name", "condition_context", "operation", "ulid", "inserted_at",
		)

	deleteBuilder := stbl.Delete("tuple")

	for _, tk := range deletes {
		id := ulid.MustNew(ulid.Timestamp(now), ulid.DefaultEntropy()).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())

		res, err := deleteBuilder.
			Where(sq.Eq{
				"store":       store,
				"object_type": objectType,
				"object_id":   objectID,
				"relation":    tk.GetRelation(),
				"_user":       tk.GetUser(),
				"user_type":   tupleUtils.GetUserTypeFromUser(tk.GetUser()),
			}).
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			return handleSQLError(err, tk)
		}

		rowsAffected, err := res.RowsAffected()
		if err != nil {
			return handleSQLError(err)
		}

		if rowsAffected != 1 {
			return storage.InvalidWriteInputError(
				tk,
				openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
			)
		}

		changelogBuilder = changelogBuilder.Values(
			store, objectType, objectID,
			tk.GetRelation(), tk.GetUser(),
			"", nil, // Redact condition info for deletes since we only need the base triplet (object, relation, user).
			openfgav1.TupleOperation_TUPLE_OPERATION_DELETE,
			id, sqlTime,
		)
	}

	insertBuilder := stbl.
		Insert("tuple").
		Columns(
			"store", "object_type", "object_id", "relation", "_user", "user_type",
			"condition_name", "condition_context", "ulid", "inserted_at",
		)

	for _, tk := range writes {
		id := ulid.MustNew(ulid.Timestamp(now), ulid.DefaultEntropy()).String()
		objectType, objectID := tupleUtils.SplitObject(tk.GetObject())

		conditionName, conditionContext, err := marshalRelationshipCondition(tk.GetCondition())
		if err != nil {
			return err
		}

		_, err = insertBuilder.
			Values(
				store,
				objectType,
				objectID,
				tk.GetRelation(),
				tk.GetUser(),
				tupleUtils.GetUserTypeFromUser(tk.GetUser()),
				conditionName,
				conditionContext,
				id,
				sqlTime,
			).
			RunWith(txn). // Part of a txn.
			ExecContext(ctx)
		if err != nil {
			return handleSQLError(err, tk)
		}

		changelogBuilder = changelogBuilder.Values(
			store,
			objectType,
			objectID,
			tk.GetRelation(),
			tk.GetUser(),
			conditionName,
			conditionContext,
			openfgav1.TupleOperation_TUPLE_OPERATION_WRITE,
			id,
			sqlTime,
		)
	}

	if len(writes) > 0 || len(deletes) > 0 {
		_, err := changelogBuilder.RunWith(txn).ExecContext(ctx) // Part of a txn.
		if err != nil {
			return handleSQLError(err)
		}
	}

	if err := txn.Commit(); err != nil {
		return handleSQLError(err)
	}

	return nil
}

// copied from https://github.com/openfga/openfga/blob/main/pkg/storage/sqlcommon/encoding.go#L8-L24
func marshalRelationshipCondition(
	rel *openfgav1.RelationshipCondition,
) (name string, context []byte, err error) {
	if rel != nil {
		if rel.GetContext() != nil && len(rel.GetContext().GetFields()) > 0 {
			context, err = proto.Marshal(rel.GetContext())
			if err != nil {
				return name, context, err
			}
		}

		return rel.GetName(), context, err
	}

	return name, context, err
}
