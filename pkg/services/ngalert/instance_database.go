package ngalert

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
)

func alertInstanceMigration(mg *migrator.Migrator) {
	alertInstance := migrator.Table{
		Name: "alert_instance",
		Columns: []*migrator.Column{
			{Name: "org_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "alert_definition_id", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "labels", Type: migrator.DB_Text, Nullable: false},
			{Name: "labels_hash", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state", Type: migrator.DB_NVarchar, Length: 190, Nullable: false},
			{Name: "current_state_since", Type: migrator.DB_BigInt, Nullable: false},
			{Name: "last_eval_time", Type: migrator.DB_BigInt, Nullable: false},
		},
		PrimaryKeys: []string{"alert_definition_id", "labels_hash"},
	}

	// create table
	mg.AddMigration("create alert_instance table", migrator.NewAddTableMigration(alertInstance))
}

// getAlertInstance is a handler for retrieving an alert instance based on OrgId, AlertDefintionID, and
// the hash of the labels.
// nolint:unused
func (ng *AlertNG) getAlertInstance(cmd *getAlertInstanceCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		instance := AlertInstance{}
		s := strings.Builder{}
		s.WriteString(`SELECT * FROM alert_instance
			WHERE
				org_id=? AND
				alert_definition_id=? AND
				labels_hash=?
		`)

		_, hash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		params := append(make([]interface{}, 0), cmd.OrgID, cmd.AlertDefinitionID, hash)

		has, err := sess.SQL(s.String(), params...).Get(&instance)
		if !has {
			return fmt.Errorf("instance not found for labels %v (hash: %v), alert definition id %v", cmd.Labels, hash, cmd.AlertDefinitionID)
		}
		if err != nil {
			return err
		}

		cmd.Result = &instance
		return nil
	})
}

// listAlertInstances is a handler for retrieving alert instances within specific organisation
// based on various filters.
// nolint:unused
func (ng *AlertNG) listAlertInstances(cmd *listAlertInstancesCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		alertInstances := make([]*AlertInstance, 0)

		s := strings.Builder{}
		params := make([]interface{}, 0)

		addToQuery := func(stmt string, p ...interface{}) {
			s.WriteString(stmt)
			params = append(params, p...)
		}

		addToQuery("SELECT * FROM alert_instance WHERE org_id = ?", cmd.OrgID)

		if cmd.AlertDefinitionID != 0 {
			addToQuery(` AND alert_definition_id = ?`, cmd.AlertDefinitionID)
		}

		if cmd.State != "" {
			addToQuery(` AND current_state = ?`, cmd.State)
		}

		if err := sess.SQL(s.String(), params...).Find(&alertInstances); err != nil {
			return err
		}

		cmd.Result = alertInstances
		return nil
	})
}

// saveAlertDefinition is a handler for saving a new alert definition.
// nolint:unused
func (ng *AlertNG) saveAlertInstance(cmd *saveAlertInstanceCommand) error {
	return ng.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		labelTupleJSON, labelsHash, err := cmd.Labels.StringAndHash()
		if err != nil {
			return err
		}

		alertInstance := &AlertInstance{
			OrgID:             cmd.OrgID,
			Labels:            cmd.Labels,
			LabelsHash:        labelsHash,
			CurrentState:      cmd.State,
			AlertDefinitionID: cmd.AlertDefinitionID,
			CurrentStateSince: time.Now(),
			LastEvalTime:      time.Now(), // TODO: Probably better to pass in to the command for more accurate timestamp
		}

		if err := validateAlertInstance(alertInstance); err != nil {
			return err
		}

		s := strings.Builder{}

		dName := ng.SQLStore.Dialect.DriverName()

		// This is the wrong way I imagine....
		switch dName {
		// sqlite3 on conflict syntax is relatively new (3.24.0 / 2018)
		case "sqlite3", "postgres":
			s.WriteString(`INSERT INTO alert_instance
			(org_id, alert_definition_id, labels, labels_hash, current_state, current_state_since, last_eval_time)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(alert_definition_id, labels_hash) DO UPDATE SET
				org_id=excluded.org_id,
				alert_definition_id=excluded.alert_definition_id,
				labels=excluded.labels,
				labels_hash=excluded.labels_hash,
				current_state=excluded.current_state,
				current_state_since=excluded.current_state_since,
				last_eval_time=excluded.last_eval_time
				`)

			// if dName == "postgres" {
			// 	s.WriteString(` RETURNING *`)
			// }

		case "mysql":
			s.WriteString(`INSERT INTO alert_instance
			(org_id, alert_definition_id, labels, labels_hash, current_state, current_state_since, last_eval_time)
				VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				org_id=VALUES(org_id),
				alert_definition_id=VALUES(alert_definition_id),
				labels=VALUES(labels),
				labels_hash=VALUES(labels_hash),
				current_state=VALUES(current_state),
				current_state_since=VALUES(current_state_since),
				last_eval_time=VALUES(last_eval_time);
			`)

		default:
			return fmt.Errorf("unsupported database type for alert instances: %v", ng.SQLStore.Dialect.DriverName())
		}

		params := append(make([]interface{}, 0), cmd.OrgID, cmd.AlertDefinitionID, labelTupleJSON, alertInstance.LabelsHash, cmd.State, time.Now().Unix(), time.Now().Unix())

		_, err = sess.SQL(s.String(), params...).Query()
		if err != nil {
			return err
		}

		return nil
	})
}
