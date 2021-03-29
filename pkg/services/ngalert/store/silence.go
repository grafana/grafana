package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/go-openapi/strfmt"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
)

func getSilenceByUID(sess *sqlstore.DBSession, silenceUID string, orgID int64) (*models.Silence, error) {
	silence := &models.Silence{
		OrgID: orgID,
		UID:   silenceUID,
	}
	has, err := sess.Get(silence)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, models.ErrSilenceNotFound
	}
	return silence, nil
}

func getSilenceByID(sess *sqlstore.DBSession, id int64) (*models.Silence, error) {
	silence := &models.Silence{}

	has, err := sess.ID(id).Get(silence)
	if err != nil {
		return nil, err
	}
	if !has {
		return nil, ErrNoAlertmanagerConfiguration
	}

	return silence, nil
}

func (st DBstore) GetOrgSilences(query *models.GetSilencesQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		silences := make([]*models.Silence, 0)
		q := "SELECT * FROM silence WHERE org_id = ?"
		if err := sess.SQL(q, query.OrgID).Find(&silences); err != nil {
			return err
		}

		query.Result = silences
		return nil
	})
}

func (st DBstore) GetSilenceByUID(query *models.GetSilenceByUIDQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		silence, err := getSilenceByUID(sess, query.UID, query.OrgID)
		if err != nil {
			return err
		}
		query.Result = silence
		return nil
	})
}

func (st DBstore) GetSilenceByID(query *models.GetSilenceByIDQuery) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		silence, err := getSilenceByID(sess, query.ID)
		if err != nil {
			return err
		}
		query.Result = silence
		return nil
	})
}

func (st DBstore) DeleteSilenceByUID(cmd *models.DeleteSilenceByUIDCommand) error {
	return st.SQLStore.WithDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := getSilenceByUID(sess, cmd.UID, cmd.OrgID)
		if err != nil && errors.Is(err, models.ErrSilenceNotFound) {
			return err
		}

		_, err = sess.Exec("DELETE FROM silence WHERE uid = ? AND org_id = ?", cmd.UID, cmd.OrgID)
		if err != nil {
			return err
		}
		return nil
	})
}

func (st DBstore) DeleteSilenceByID(cmd *models.DeleteSilenceByIDCommand) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		_, err := getSilenceByID(sess, cmd.ID)
		if err != nil && errors.Is(err, models.ErrSilenceNotFound) {
			return err
		}

		_, err = sess.Exec("DELETE FROM silence WHERE id ?", cmd.ID)
		if err != nil {
			return err
		}
		return nil
	})
}

func (st DBstore) SaveSilence(cmd *models.SaveSilenceCommand) error {
	return st.SQLStore.WithTransactionalDbSession(context.Background(), func(sess *sqlstore.DBSession) error {
		var firstSeen bool
		existingSilence, err := getSilenceByUID(sess, cmd.UID, cmd.OrgID)
		if err != nil {
			if !errors.Is(err, models.ErrSilenceNotFound) {
				return err
			}
			firstSeen = true
		}

		statusPending := amv2.SilenceStatusStatePending
		updatedAt := strfmt.DateTime(TimeNow())

		silenceModel := models.Silence{
			OrgID:     cmd.OrgID,
			UID:       cmd.UID,
			Status:    models.SilenceStatus{State: &statusPending},
			UpdatedAt: updatedAt,
			Comment:   *cmd.Comment,
			CreatedBy: *cmd.CreatedBy,
			EndsAt:    *cmd.EndsAt,
			Matchers:  models.Matchers(cmd.Matchers),
			StartsAt:  *cmd.StartsAt,
		}

		switch firstSeen {
		case true:
			if _, err := sess.Insert(&silenceModel); err != nil {
				return fmt.Errorf("failed to insert silence: %w", err)
			}
		default:
			if _, err := sess.ID(existingSilence.ID).Update(&silenceModel); err != nil {
				return fmt.Errorf("failed to update silence: %w", err)
			}
		}

		return nil
	})
}

func GenerateNewSilenceUID(sess *sqlstore.DBSession, orgID int64) (string, error) {
	for i := 0; i < 3; i++ {
		uid := util.GenerateShortUID()

		exists, err := sess.Where("org_id=? AND uid=?", orgID, uid).Get(&models.Silence{})
		if err != nil {
			return "", err
		}

		if !exists {
			return uid, nil
		}
	}

	return "", models.ErrSilenceFailedGenerateUniqueUID
}
