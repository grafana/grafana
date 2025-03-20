package metadata

import (
	"context"
	"errors"
	"fmt"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/storage/secret"
	"github.com/grafana/grafana/pkg/storage/unified/sql/sqltemplate"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	"k8s.io/apimachinery/pkg/labels"
)

// keeperMetadataStorage is the actual implementation of the keeper metadata storage.
type keeperMetadataStorage struct {
	db           *session.SessionDB
	dialect      sqltemplate.Dialect
	accessClient claims.AccessClient
}

var _ secret.KeeperMetadataStorage = (*keeperMetadataStorage)(nil)

func ProvideKeeperMetadataStorage(db db.DB, features featuremgmt.FeatureToggles, accessClient claims.AccessClient) (contracts.KeeperMetadataStorage, error) {
	if !features.IsEnabledGlobally(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs) ||
		!features.IsEnabledGlobally(featuremgmt.FlagSecretsManagementAppPlatform) {
		return &keeperMetadataStorage{}, nil
	}

	return &keeperMetadataStorage{
		// TODO LND is this ok or should we get a session for each operation?
		db:           db.GetSqlxSession(),
		dialect:      sqltemplate.DialectForDriver(string(db.GetDBType())),
		accessClient: accessClient,
	}, nil
}

func (s *keeperMetadataStorage) Create(ctx context.Context, keeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	// TODO LND REMOVE
	logging.DefaultLogger.Info("--- LND: SQL CREATE executed")

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
		return nil, fmt.Errorf("read template %q: %w", q, err)
	}

	err = s.db.WithTransaction(ctx, func(sess *session.SessionTx) error {
		// Validate before inserting that any `secureValues` referenced exist and do not reference other third-party keepers.
		if err := s.validateSecureValueReferences(sess, keeper); err != nil {
			return err
		}

		if _, err := sess.Exec(ctx, q, req.GetArgs()...); err != nil {
			return fmt.Errorf("failed to insert row: %w", err)
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
	// TODO LND REMOVE
	logging.DefaultLogger.Info("--- LND: SQL READ executed")

	_, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	req := &readKeeper{
		SQLTemplate: sqltemplate.New(s.dialect),
		Namespace:   namespace.String(),
		Name:        name,
	}
	q, err := sqltemplate.Execute(sqlKeeperRead, req)
	if err != nil {
		return nil, fmt.Errorf("read template %q: %w", q, err)
	}

	var keeper *secretv0alpha1.Keeper
	err = s.db.WithTransaction(ctx, func(sess *session.SessionTx) error {
		res, err := sess.Query(ctx, q, req.GetArgs()...)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}

		defer func() { _ = res.Close() }()

		if res.Next() {
			row := &keeperDB{}
			err = res.Scan(&row.GUID,
				&row.Name, &row.Namespace, &row.Annotations,
				&row.Labels,
				&row.Created, &row.CreatedBy,
				&row.Updated, &row.UpdatedBy,
				&row.Title, &row.Type, &row.Payload,
			)

			keeper, err = row.toKubernetes()
			if err != nil {
				return fmt.Errorf("failed to convert to kubernetes object: %w", err)
			}
			return nil
		}

		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}
	if keeper != nil {
		return keeper, nil
	}

	return nil, contracts.ErrKeeperNotFound
}

func (s *keeperMetadataStorage) Update(ctx context.Context, newKeeper *secretv0alpha1.Keeper) (*secretv0alpha1.Keeper, error) {
	// TODO LND REMOVE
	logging.DefaultLogger.Info("--- LND: SQL UPDATE executed")

	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return nil, fmt.Errorf("missing auth info in context")
	}

	var oldKeeper *secretv0alpha1.Keeper
	err := s.db.WithTransaction(ctx, func(sess *session.SessionTx) error {
		// Validate before updating that any `secureValues` referenced exist and do not reference other third-party keepers.\

		if err := s.validateSecureValueReferences(sess, newKeeper); err != nil {
			return err
		}

		var err error
		oldKeeper, err = s.Read(ctx, xkube.Namespace(newKeeper.Namespace), newKeeper.Name)
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

	oldKeeperRow, err := toKeeperRow(oldKeeper)
	if err != nil {
		return nil, fmt.Errorf("failed to map to row: %w", err)
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
		return nil, fmt.Errorf("update template %q: %w", q, err)
	}

	err = s.db.WithTransaction(ctx, func(sess *session.SessionTx) error {
		if _, err := sess.Exec(ctx, q, req.GetArgs()...); err != nil {
			return fmt.Errorf("failed to update row: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("db failure: %w", err)
	}

	// TODO LND We are converting the new row(before the update operation) , should we query the db again??
	keeper, err := newRow.toKubernetes()
	if err != nil {
		return nil, fmt.Errorf("failed to convert to kubernetes object: %w", err)
	}
	return keeper, nil
}

func (s *keeperMetadataStorage) Delete(ctx context.Context, namespace xkube.Namespace, name string) error {
	// TODO LND REMOVE
	logging.DefaultLogger.Info("--- LND: SQL DELETE executed")

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
		return fmt.Errorf("delete template %q: %w", q, err)
	}

	err = s.db.WithTransaction(ctx, func(sess *session.SessionTx) error {
		// should we check the result?
		if _, err := sess.Exec(ctx, q, req.GetArgs()...); err != nil {
			return fmt.Errorf("failed to delete row: %w", err)
		}

		return nil
	})
	if err != nil {
		return fmt.Errorf("db failure: %w", err)
	}

	return nil
}

func (s *keeperMetadataStorage) List(ctx context.Context, namespace xkube.Namespace, options *internalversion.ListOptions) (*secretv0alpha1.KeeperList, error) {
	// TODO LND REMOVE
	logging.DefaultLogger.Info("--- LND: SQL LIST executed")

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
		return nil, fmt.Errorf("list template %q: %w", q, err)
	}

	keeperRows := make([]*keeperDB, 0)

	rows, err := s.db.Query(ctx, q, req.GetArgs()...)
	if err != nil {
		return nil, fmt.Errorf("list template %q: %w", q, err)
	}

	keepers := make([]secretv0alpha1.Keeper, 0, len(keeperRows))

	for rows.Next() {
		row := keeperDB{}

		err = rows.Scan(&row.GUID,
			&row.Name, &row.Namespace, &row.Annotations,
			&row.Labels,
			&row.Created, &row.CreatedBy,
			&row.Updated, &row.UpdatedBy,
			&row.Title, &row.Type, &row.Payload,
		)

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
func (s *keeperMetadataStorage) validateSecureValueReferences(sess *session.SessionTx, keeper *secretv0alpha1.Keeper) error {
	usedSecureValues := extractSecureValues(keeper)

	// No secure values are referenced, return early.
	if len(usedSecureValues) == 0 {
		return nil
	}

	secureValueCond := &secureValueDB{Namespace: keeper.Namespace}
	secureValueRows := make([]*secureValueDB, 0)

	// TODO LND Replace with template query
	// SELECT * FROM secret_secure_value WHERE name IN (...) AND namespace = ? FOR UPDATE;
	err := sess.Table(secureValueCond.TableName()).ForUpdate().In("name", usedSecureValues).Find(&secureValueRows, secureValueCond)
	if err != nil {
		return fmt.Errorf("check securevalues existence: %w", err)
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

	keeperCond := &keeperDB{Namespace: keeper.Namespace}
	thirdPartyKeepers := make([]*keeperDB, 0)

	// TODO LND Replace with template query
	// SELECT * FROM secret_keeper WHERE name IN (...) AND namespace = ? AND type != 'sql' FOR UPDATE;
	err = sess.Table(keeperCond.TableName()).ForUpdate().In("name", keeperNames).Where("type != ?", contracts.SQLKeeperType).Find(&thirdPartyKeepers, keeperCond)
	if err != nil {
		return fmt.Errorf("check keepers type: %w", err)
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
	kp := &keeperDB{Namespace: namespace, Name: name}
	err := s.db.WithDbSession(ctx, func(sess *sqlstore.DBSession) error {
		found, err := sess.Get(kp)
		if err != nil {
			return fmt.Errorf("failed to get row: %w", err)
		}
		if !found {
			return contracts.ErrKeeperNotFound
		}

		return nil
	})
	if err != nil {
		return "", nil, fmt.Errorf("db failure: %w", err)
	}

	keeperConfig := toProvider(kp.Type, kp.Payload)

	// TODO: this would be a good place to check if credentials are secure values and load them.

	return kp.Type, keeperConfig, nil
}
