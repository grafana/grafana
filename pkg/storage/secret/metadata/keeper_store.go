package metadata

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"
)

// keeperMetadataStorage is the actual implementation of the keeper metadata storage.
type keeperMetadataStorage struct {
	db           db.DB
	dialect      sqltemplate.Dialect
	accessClient claims.AccessClient
}

var _ contracts.KeeperMetadataStorage = (*keeperMetadataStorage)(nil)

func ProvideKeeperMetadataStorage(db db.DB, features featuremgmt.FeatureToggles, accessClient claims.AccessClient) (contracts.KeeperMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &keeperMetadataStorage{}, nil
	}

	return &keeperMetadataStorage{
		db:           db,
		dialect:      sqltemplate.DialectForDriver(string(db.GetDBType())),
		accessClient: accessClient,
	}, nil
}

func (s *keeperMetadataStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	row, err := toKeeperCreateRow(keeper, authInfo.GetUID())
	if err != nil {
		return nil, fmt.Errorf("failed to create row: %w", err)
	}

	req := createKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         row,
	}
	q, err := sqltemplate.Execute(sqlKeeperCreate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperCreate.Name(), err)
	}

	err = s.db.GetSqlxSession().WithTransaction(ctx, func(sess *session.SessionTx) error {
		// Validate before inserting that any `secureValues` referenced exist and do not reference other third-party keepers.
		if err := s.validateSecureValueReferences(ctx, sess, keeper); err != nil {
			return err
		}

		if _, err := sess.Exec(ctx, q, req.GetArgs()...); err != nil {
			return fmt.Errorf("inserting row: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	createdKeeper, err := row.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	return createdKeeper, nil
}

func (s *keeperMetadataStorage) Read(ctx context.Context, namespace xkube.Namespace, name string) (*secretv0alpha1.Keeper, error) {
	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	k, err := s.read(ctx, s.db.GetSqlxSession(), namespace.String(), name)
	if err != nil {
		return nil, err
	}

	var keeper *secretv0alpha1.Keeper

	keeper, err = k.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}

	if keeper != nil {
		return keeper, nil
	}

	return nil, contracts.ErrKeeperNotFound
}

type dbQuerier interface {
	Query(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func (s *keeperMetadataStorage) read(ctx context.Context, dbQuerier dbQuerier, namespace string, name string) (*keeperDB, error) {
	req := &readKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace,
		Name:        name,
	}
	q, err := sqltemplate.Execute(sqlKeeperRead, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperRead.Name(), err)
	}

	res, err := dbQuerier.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("getting row: %w", err)
	}
	defer func() { _ = res.Close() }()

	if !res.Next() {
		return nil, contracts.ErrKeeperNotFound
	}

	keeper := &keeperDB{}
	err = res.Scan(&keeper.GUID,
		&keeper.Name, &keeper.Namespace, &keeper.Annotations,
		&keeper.Labels,
		&keeper.Created, &keeper.CreatedBy,
		&keeper.Updated, &keeper.UpdatedBy,
		&keeper.Title, &keeper.Type, &keeper.Payload,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to scan keeper row: %w", err)
	}
	if err := res.Err(); err != nil {
		return nil, fmt.Errorf("read rows error: %w", err)
	}

	return keeper, nil
}

func (s *keeperMetadataStorage) Update(ctx context.Context, newKeeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	var oldKeeperRow *keeperDB
	err := s.db.GetSqlxSession().WithTransaction(ctx, func(sess *session.SessionTx) error {
		// Validate before updating that any `secureValues` referenced exist and do not reference other third-party keepers.\

		if err := s.validateSecureValueReferences(ctx, sess, newKeeper); err != nil {
			return err
		}

		var err error
		oldKeeperRow, err = s.read(ctx, sess, newKeeper.Namespace, newKeeper.Name)
		if err != nil {
			if errors.Is(err, contracts.ErrKeeperNotFound) {
				return err
			}
			return fmt.Errorf("failed to get row: %w", err)
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	newRow, err := toKeeperUpdateRow(oldKeeperRow, newKeeper, authInfo.GetUID())
	if err != nil {
		return nil, fmt.Errorf("failed to map into update row: %w", err)
	}

	req := &updateKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Row:         newRow,
	}
	q, err := sqltemplate.Execute(sqlKeeperUpdate, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperUpdate.Name(), err)
	}

	if _, err = s.db.GetSqlxSession().Exec(ctx, q, req.GetArgs()...); err != nil {
		return nil, fmt.Errorf("updating row: %w", err)
	}

	// TODO We are converting the new row(before the update operation) , should we query the db again??
	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}
	return keeper, nil
}

func (s *keeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return fmt.Errorf("missing auth info in context")
	}

	req := deleteKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}

	q, err := sqltemplate.Execute(sqlKeeperDelete, req)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlKeeperDelete.Name(), err)
	}

	err = s.db.GetSqlxSession().WithTransaction(ctx, func(sess *session.SessionTx) error {
		// should we check the result?
		if _, err := sess.Exec(ctx, q, req.GetArgs()...); err != nil {
			return fmt.Errorf("deleting row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *keeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	user, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	hasPermissionFor, err := s.accessClient.Compile(ctx, user, claims.ListRequest{
		Group:     secretv0alpha1.GROUP,
		Resource:  secretv0alpha1.KeeperResourceInfo.GetName(),
		Namespace: namespace.String(),
		Verb:      utils.VerbGet, // Why not VerbList?
	})
	if err != nil {
		return nil, fmt.Errorf("failed to compile checker: %w", err)
	}

	labelSelector := options.LabelSelector
	if labelSelector == nil {
		labelSelector = labels.Everything()
	}

	req := listKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
	}

	q, err := sqltemplate.Execute(sqlKeeperList, req)
	if err != nil {
		return nil, fmt.Errorf("execute template %q: %w", sqlKeeperList.Name(), err)
	}

	rows, err := s.db.GetSqlxSession().Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("listing keepers %q: %w", q, err)
	}

	keepers := make([]secretv0alpha1.Keeper, 0)

	for rows.Next() {
		row := keeperDB{}

		err = rows.Scan(&row.GUID,
			&row.Name, &row.Namespace, &row.Annotations,
			&row.Labels,
			&row.Created, &row.CreatedBy,
			&row.Updated, &row.UpdatedBy,
			&row.Title, &row.Type, &row.Payload,
		)
		if err != nil {
			return nil, fmt.Errorf("error reading keeper row: %w", err)
		}

		// Check whether the user has permission to access this specific Keeper in the namespace.
		if !hasPermissionFor(row.Name, "") {
			continue
		}

		keeper, err := row.toKubernetes()
		if err != nil {
			return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
		}

		if labelSelector.Matches(labels.Set(keeper.Labels)) {
			keepers = append(keepers, *keeper)
		}
	}

	return &secretv0alpha1.KeeperList{
		Items: keepers,
	}, nil
}

// validateSecureValueReferences checks that all secure values referenced by the keeper exist and are not referenced by other third-party keepers.
func (s *keeperMetadataStorage) validateSecureValueReferences(ctx context.Context, sess *session.SessionTx, keeper *secretv0alpha1.Keeper) error {
	usedSecureValues := extractSecureValues(keeper)

	// No secure values are referenced, return early.
	if len(usedSecureValues) == 0 {
		return nil
	}

	reqSecValue := listByNameSecureValue{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Namespace:        keeper.Namespace,
		UsedSecureValues: usedSecureValues,
	}

	qSecValue, err := sqltemplate.Execute(sqlSecureValueListByName, reqSecValue)
	if err != nil {
		return fmt.Errorf("execute template %q: %w", sqlSecureValueListByName.Name(), err)
	}

	rows, err := sess.Query(ctx, qSecValue, reqSecValue.GetArgs()...)
	if err != nil {
		return fmt.Errorf("executing query: %w", err)
	}

	defer func() {
		_ = rows.Close()
	}()

	secureValueRows := make([]*secureValueDB, 0)
	for rows.Next() {
		row := secureValueDB{}
		err = rows.Scan(
			&row.Name, &row.Keeper,
		)
		if err != nil {
			return fmt.Errorf("error reading secret value row: %w", err)
		}
		secureValueRows = append(secureValueRows, &row)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("secret value rows error: %w", err)
	}

	// If not all secure values being referenced exist, return an error with the missing ones.
	if len(secureValueRows) != len(usedSecureValues) {
		// We are guaranteed that the returned `secureValueRows` are a subset of `usedSecureValues`,
		// so we don't need to check the other way around.
		missing := make(map[string]struct{}, len(usedSecureValues))
		for _, sv := range usedSecureValues {
			missing[sv] = struct{}{}
		}

		for _, svRow := range secureValueRows {
			delete(missing, svRow.Name)
		}

		return contracts.NewErrKeeperInvalidSecureValues(missing)
	}

	// If all secure values exist, we need to guarantee that the third-party keeper is not referencing another third-party,
	// it must reference only 'sql' type keepers to keep the dependency tree flat (n=1).
	keeperNames := make([]string, 0, len(secureValueRows))
	keeperSecureValues := make(map[string][]string, 0)

	for _, svRow := range secureValueRows {
		keeperNames = append(keeperNames, svRow.Keeper)
		keeperSecureValues[svRow.Keeper] = append(keeperSecureValues[svRow.Keeper], svRow.Name)
	}

	reqKeeper := listByNameKeeper{
		SQLTemplate:      sqltemplate.New(s.dialect),
		Namespace:        keeper.Namespace,
		KeeperNames:      keeperNames,
		ExcludeSQLKeeper: string(contracts.SQLKeeperType),
	}

	qKeeper, err := sqltemplate.Execute(sqlKeeperListByName, reqKeeper)
	if err != nil {
		return fmt.Errorf("template %q: %w", sqlKeeperListByName.Name(), err)
	}

	keepersRows, err := sess.Query(ctx, qKeeper, reqKeeper.GetArgs()...)
	if err != nil {
		return fmt.Errorf("listing by name %q: %w", qKeeper, err)
	}

	defer func() {
		_ = keepersRows.Close()
	}()

	thirdPartyKeepers := make([]*keeperDB, 0)
	for rows.Next() {
		row := keeperDB{}
		err = keepersRows.Scan(&row.Name)
		if err != nil {
			return fmt.Errorf("error reading keeper row: %w", err)
		}
		thirdPartyKeepers = append(thirdPartyKeepers, &row)
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("third party keeper rows error: %w", err)
	}

	// Found secureValueNames that are referenced by third-party keepers.
	if len(thirdPartyKeepers) > 0 {
		invalidSecureValues := make(map[string]string, 0)

		for _, thirdPartyKeeper := range thirdPartyKeepers {
			for _, svName := range keeperSecureValues[thirdPartyKeeper.Name] {
				invalidSecureValues[svName] = thirdPartyKeeper.Name
			}
		}

		return contracts.NewErrKeeperInvalidSecureValuesReference(invalidSecureValues)
	}

	return nil
}

func (s *keeperMetadataStorage) GetKeeperConfig(ctx context.Context, namespace string, name string) (contracts.KeeperType, secretv0alpha1.KeeperConfig, error) {
	// Check if keeper is default sql.
	if name == contracts.DefaultSQLKeeper {
		return contracts.SQLKeeperType, nil, nil
	}

	// Load keeper config from metadata store, or TODO: keeper cache.
	kp, err := s.read(ctx, s.db.GetSqlxSession(), namespace, name)
	if err != nil {
		return "", nil, err
	}

	keeperConfig := toProvider(kp.Type, kp.Payload)

	// TODO: this would be a good place to check if credentials are secure values and load them.
	return kp.Type, keeperConfig, nil
}
