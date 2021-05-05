package libraryelements

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

var (
	selectLibraryElementDTOWithMeta = `
SELECT DISTINCT
	le.name, le.id, le.org_id, le.folder_id, le.uid, le.kind, le.type, le.description, le.model, le.created, le.created_by, le.updated, le.updated_by, le.version
	, u1.login AS created_by_name
	, u1.email AS created_by_email
	, u2.login AS updated_by_name
	, u2.email AS updated_by_email
	, (SELECT COUNT(dashboard_id) FROM library_element_dashboard WHERE library_element_id = le.id) AS connected_dashboards
`
	fromLibraryElementDTOWithMeta = `
FROM library_element AS le
	LEFT JOIN user AS u1 ON le.created_by = u1.id
	LEFT JOIN user AS u2 ON le.updated_by = u2.id
`
	sqlLibraryElementDTOWithMeta = selectLibraryElementDTOWithMeta + fromLibraryElementDTOWithMeta
)

func syncFieldsWithModel(libraryElement *LibraryElement) error {
	var model map[string]interface{}
	if err := json.Unmarshal(libraryElement.Model, &model); err != nil {
		return err
	}

	model["title"] = libraryElement.Name
	if model["type"] != nil {
		libraryElement.Type = model["type"].(string)
	} else {
		model["type"] = libraryElement.Type
	}
	if model["description"] != nil {
		libraryElement.Description = model["description"].(string)
	} else {
		model["description"] = libraryElement.Description
	}
	syncedModel, err := json.Marshal(&model)
	if err != nil {
		return err
	}

	libraryElement.Model = syncedModel

	return nil
}

func getLibraryElement(session *sqlstore.DBSession, uid string, orgID int64) (LibraryElementWithMeta, error) {
	elements := make([]LibraryElementWithMeta, 0)
	sql := sqlLibraryElementDTOWithMeta + "WHERE le.uid=? AND le.org_id=?"
	sess := session.SQL(sql, uid, orgID)
	err := sess.Find(&elements)
	if err != nil {
		return LibraryElementWithMeta{}, err
	}
	if len(elements) == 0 {
		return LibraryElementWithMeta{}, errLibraryElementNotFound
	}
	if len(elements) > 1 {
		return LibraryElementWithMeta{}, fmt.Errorf("found %d elements, while expecting at most one", len(elements))
	}

	return elements[0], nil
}

// createLibraryElement adds a library element.
func (l *LibraryElementService) createLibraryElement(c *models.ReqContext, cmd createLibraryElementCommand) (LibraryElementDTO, error) {
	entity := LibraryElement{
		OrgID:    c.SignedInUser.OrgId,
		FolderID: cmd.FolderID,
		UID:      util.GenerateShortUID(),
		Name:     cmd.Name,
		Model:    cmd.Model,
		Version:  1,
		Kind:     cmd.Kind,

		Created: time.Now(),
		Updated: time.Now(),

		CreatedBy: c.SignedInUser.UserId,
		UpdatedBy: c.SignedInUser.UserId,
	}

	if err := syncFieldsWithModel(&entity); err != nil {
		return LibraryElementDTO{}, err
	}

	err := l.SQLStore.WithTransactionalDbSession(c.Context.Req.Context(), func(session *sqlstore.DBSession) error {
		if err := l.requirePermissionsOnFolder(c.SignedInUser, cmd.FolderID); err != nil {
			return err
		}
		if _, err := session.Insert(&entity); err != nil {
			if l.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return errLibraryElementAlreadyExists
			}
			return err
		}
		return nil
	})

	dto := LibraryElementDTO{
		ID:          entity.ID,
		OrgID:       entity.OrgID,
		FolderID:    entity.FolderID,
		UID:         entity.UID,
		Name:        entity.Name,
		Kind:        entity.Kind,
		Type:        entity.Type,
		Description: entity.Description,
		Model:       entity.Model,
		Version:     entity.Version,
		Meta: LibraryElementDTOMeta{
			ConnectedDashboards: 0,
			Created:             entity.Created,
			Updated:             entity.Updated,
			CreatedBy: LibraryElementDTOMetaUser{
				ID:        entity.CreatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
			UpdatedBy: LibraryElementDTOMetaUser{
				ID:        entity.UpdatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
		},
	}

	return dto, err
}

// deleteLibraryElement deletes a library element.
func (l *LibraryElementService) deleteLibraryElement(c *models.ReqContext, uid string) error {
	return l.SQLStore.WithTransactionalDbSession(c.Context.Req.Context(), func(session *sqlstore.DBSession) error {
		panel, err := getLibraryElement(session, uid, c.SignedInUser.OrgId)
		if err != nil {
			return err
		}
		if err := l.requirePermissionsOnFolder(c.SignedInUser, panel.FolderID); err != nil {
			return err
		}
		var dashIDs []struct {
			DashboardID int64 `xorm:"dashboard_id"`
		}
		sql := "SELECT dashboard_id FROM library_element_dashboard WHERE library_element_id=?"
		if err := session.SQL(sql, panel.ID).Find(&dashIDs); err != nil {
			return err
		} else if len(dashIDs) > 0 {
			return errLibraryElementHasConnectedDashboards
		}

		result, err := session.Exec("DELETE FROM library_element WHERE id=?", panel.ID)
		if err != nil {
			return err
		}
		if rowsAffected, err := result.RowsAffected(); err != nil {
			return err
		} else if rowsAffected != 1 {
			return errLibraryElementNotFound
		}

		return nil
	})
}
