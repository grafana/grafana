package libraryelements

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/services/search"

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

	if LibraryElementKind(libraryElement.Kind) == Panel {
		model["title"] = libraryElement.Name
	}
	if LibraryElementKind(libraryElement.Kind) == Variable {
		model["name"] = libraryElement.Name
	}
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

// getLibraryElement gets a Library Element.
func (l *LibraryElementService) getLibraryElement(c *models.ReqContext, uid string) (LibraryElementDTO, error) {
	var libraryPanel LibraryElementWithMeta
	err := l.SQLStore.WithDbSession(c.Context.Req.Context(), func(session *sqlstore.DBSession) error {
		libraryPanels := make([]LibraryElementWithMeta, 0)
		builder := sqlstore.SQLBuilder{}
		builder.Write(selectLibraryElementDTOWithMeta)
		builder.Write(", 'General' as folder_name ")
		builder.Write(", '' as folder_uid ")
		builder.Write(fromLibraryElementDTOWithMeta)
		builder.Write(` WHERE le.uid=? AND le.org_id=? AND le.folder_id=0`, uid, c.SignedInUser.OrgId)
		builder.Write(" UNION ")
		builder.Write(selectLibraryElementDTOWithMeta)
		builder.Write(", dashboard.title as folder_name ")
		builder.Write(", dashboard.uid as folder_uid ")
		builder.Write(fromLibraryElementDTOWithMeta)
		builder.Write(" INNER JOIN dashboard AS dashboard on le.folder_id = dashboard.id AND le.folder_id <> 0")
		builder.Write(` WHERE le.uid=? AND le.org_id=?`, uid, c.SignedInUser.OrgId)
		if c.SignedInUser.OrgRole != models.ROLE_ADMIN {
			builder.WriteDashboardPermissionFilter(c.SignedInUser, models.PERMISSION_VIEW)
		}
		builder.Write(` OR dashboard.id=0`)
		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&libraryPanels); err != nil {
			return err
		}
		if len(libraryPanels) == 0 {
			return errLibraryElementNotFound
		}
		if len(libraryPanels) > 1 {
			return fmt.Errorf("found %d panels, while expecting at most one", len(libraryPanels))
		}

		libraryPanel = libraryPanels[0]

		return nil
	})

	dto := LibraryElementDTO{
		ID:          libraryPanel.ID,
		OrgID:       libraryPanel.OrgID,
		FolderID:    libraryPanel.FolderID,
		UID:         libraryPanel.UID,
		Name:        libraryPanel.Name,
		Type:        libraryPanel.Type,
		Description: libraryPanel.Description,
		Model:       libraryPanel.Model,
		Version:     libraryPanel.Version,
		Meta: LibraryElementDTOMeta{
			FolderName:          libraryPanel.FolderName,
			FolderUID:           libraryPanel.FolderUID,
			ConnectedDashboards: libraryPanel.ConnectedDashboards,
			Created:             libraryPanel.Created,
			Updated:             libraryPanel.Updated,
			CreatedBy: LibraryElementDTOMetaUser{
				ID:        libraryPanel.CreatedBy,
				Name:      libraryPanel.CreatedByName,
				AvatarUrl: dtos.GetGravatarUrl(libraryPanel.CreatedByEmail),
			},
			UpdatedBy: LibraryElementDTOMetaUser{
				ID:        libraryPanel.UpdatedBy,
				Name:      libraryPanel.UpdatedByName,
				AvatarUrl: dtos.GetGravatarUrl(libraryPanel.UpdatedByEmail),
			},
		},
	}

	return dto, err
}

// getAllLibraryElements gets all Library Elements.
func (l *LibraryElementService) getAllLibraryElements(c *models.ReqContext, query searchLibraryElementsQuery) (LibraryElementSearchResult, error) {
	elements := make([]LibraryElementWithMeta, 0)
	result := LibraryElementSearchResult{}
	if query.perPage <= 0 {
		query.perPage = 100
	}
	if query.page <= 0 {
		query.page = 1
	}
	var typeFilter []string
	if len(strings.TrimSpace(query.typeFilter)) > 0 {
		typeFilter = strings.Split(query.typeFilter, ",")
	}
	folderFilter := parseFolderFilter(query)
	if folderFilter.parseError != nil {
		return LibraryElementSearchResult{}, folderFilter.parseError
	}
	err := l.SQLStore.WithDbSession(c.Context.Req.Context(), func(session *sqlstore.DBSession) error {
		builder := sqlstore.SQLBuilder{}
		if folderFilter.includeGeneralFolder {
			builder.Write(selectLibraryElementDTOWithMeta)
			builder.Write(", 'General' as folder_name ")
			builder.Write(", '' as folder_uid ")
			builder.Write(fromLibraryElementDTOWithMeta)
			builder.Write(` WHERE le.org_id=?  AND le.folder_id=0`, c.SignedInUser.OrgId)
			writeKindSQL(query, &builder)
			writeSearchStringSQL(query, l.SQLStore, &builder)
			writeExcludeSQL(query, &builder)
			writeTypeFilterSQL(typeFilter, &builder)
			builder.Write(" UNION ")
		}
		builder.Write(selectLibraryElementDTOWithMeta)
		builder.Write(", dashboard.title as folder_name ")
		builder.Write(", dashboard.uid as folder_uid ")
		builder.Write(fromLibraryElementDTOWithMeta)
		builder.Write(" INNER JOIN dashboard AS dashboard on le.folder_id = dashboard.id AND le.folder_id<>0")
		builder.Write(` WHERE le.org_id=?`, c.SignedInUser.OrgId)
		writeKindSQL(query, &builder)
		writeSearchStringSQL(query, l.SQLStore, &builder)
		writeExcludeSQL(query, &builder)
		writeTypeFilterSQL(typeFilter, &builder)
		if err := folderFilter.writeFolderFilterSQL(false, &builder); err != nil {
			return err
		}
		if c.SignedInUser.OrgRole != models.ROLE_ADMIN {
			builder.WriteDashboardPermissionFilter(c.SignedInUser, models.PERMISSION_VIEW)
		}
		if query.sortDirection == search.SortAlphaDesc.Name {
			builder.Write(" ORDER BY 1 DESC")
		} else {
			builder.Write(" ORDER BY 1 ASC")
		}
		writePerPageSQL(query, l.SQLStore, &builder)
		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&elements); err != nil {
			return err
		}

		retDTOs := make([]LibraryElementDTO, 0)
		for _, panel := range elements {
			retDTOs = append(retDTOs, LibraryElementDTO{
				ID:          panel.ID,
				OrgID:       panel.OrgID,
				FolderID:    panel.FolderID,
				UID:         panel.UID,
				Name:        panel.Name,
				Type:        panel.Type,
				Description: panel.Description,
				Model:       panel.Model,
				Version:     panel.Version,
				Meta: LibraryElementDTOMeta{
					FolderName:          panel.FolderName,
					FolderUID:           panel.FolderUID,
					ConnectedDashboards: panel.ConnectedDashboards,
					Created:             panel.Created,
					Updated:             panel.Updated,
					CreatedBy: LibraryElementDTOMetaUser{
						ID:        panel.CreatedBy,
						Name:      panel.CreatedByName,
						AvatarUrl: dtos.GetGravatarUrl(panel.CreatedByEmail),
					},
					UpdatedBy: LibraryElementDTOMetaUser{
						ID:        panel.UpdatedBy,
						Name:      panel.UpdatedByName,
						AvatarUrl: dtos.GetGravatarUrl(panel.UpdatedByEmail),
					},
				},
			})
		}

		var panels []LibraryElement
		countBuilder := sqlstore.SQLBuilder{}
		countBuilder.Write("SELECT * FROM library_element AS le")
		countBuilder.Write(` WHERE le.org_id=?`, c.SignedInUser.OrgId)
		writeKindSQL(query, &countBuilder)
		writeSearchStringSQL(query, l.SQLStore, &countBuilder)
		writeExcludeSQL(query, &countBuilder)
		writeTypeFilterSQL(typeFilter, &countBuilder)
		if err := folderFilter.writeFolderFilterSQL(true, &countBuilder); err != nil {
			return err
		}
		if err := session.SQL(countBuilder.GetSQLString(), countBuilder.GetParams()...).Find(&panels); err != nil {
			return err
		}

		result = LibraryElementSearchResult{
			TotalCount: int64(len(panels)),
			Elements:   retDTOs,
			Page:       query.page,
			PerPage:    query.perPage,
		}

		return nil
	})

	return result, err
}
