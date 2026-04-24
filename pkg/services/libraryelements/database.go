package libraryelements

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/metrics"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/search/sort"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	selectLibraryElementDTOWithMeta = `
SELECT DISTINCT
	le.name, le.id, le.org_id, le.folder_id, le.uid, le.kind, le.type, le.description, le.model, le.created, le.created_by, le.updated, le.updated_by, le.version
	, u1.login AS created_by_name
	, u1.email AS created_by_email
	, u2.login AS updated_by_name
	, u2.email AS updated_by_email`
)

func getFromLibraryElementDTOWithMeta(dialect migrator.Dialect) string {
	user := dialect.Quote("user")
	userJoin := `
FROM library_element AS le
LEFT JOIN ` + user + ` AS u1 ON le.created_by = u1.id
LEFT JOIN ` + user + ` AS u2 ON le.updated_by = u2.id
`
	return userJoin
}

func syncFieldsWithModel(libraryElement *model.LibraryElement) error {
	var modelLibraryElement map[string]any
	if err := json.Unmarshal(libraryElement.Model, &modelLibraryElement); err != nil {
		return err
	}

	if modelLibraryElement == nil {
		modelLibraryElement = make(map[string]any)
	}

	if modelLibraryElement["type"] != nil {
		libraryElement.Type = modelLibraryElement["type"].(string)
	} else {
		modelLibraryElement["type"] = libraryElement.Type
	}
	if modelLibraryElement["description"] != nil {
		libraryElement.Description = modelLibraryElement["description"].(string)
	} else {
		modelLibraryElement["description"] = libraryElement.Description
	}
	syncedModel, err := json.Marshal(&modelLibraryElement)
	if err != nil {
		return err
	}

	libraryElement.Model = syncedModel

	return nil
}

func (l *LibraryElementService) GetLibraryElement(c context.Context, signedInUser identity.Requester, session *db.Session, uid string) (model.LibraryElementWithMeta, error) {
	elements := make([]model.LibraryElementWithMeta, 0)
	sql := selectLibraryElementDTOWithMeta +
		getFromLibraryElementDTOWithMeta(l.SQLStore.GetDialect()) +
		" WHERE le.uid=? AND le.org_id=?"
	sess := session.SQL(sql, uid, signedInUser.GetOrgID())
	err := sess.Find(&elements)
	if err != nil {
		return model.LibraryElementWithMeta{}, err
	}
	if len(elements) == 0 {
		return model.LibraryElementWithMeta{}, model.ErrLibraryElementNotFound
	}
	if len(elements) > 1 {
		return model.LibraryElementWithMeta{}, fmt.Errorf("found %d elements, while expecting at most one", len(elements))
	}

	// get the folder title
	f, err := l.folderService.Get(c, &folder.GetFolderQuery{
		OrgID:        elements[0].OrgID,
		UID:          &elements[0].FolderUID,
		SignedInUser: signedInUser,
	})
	if err == nil {
		elements[0].FolderName = f.Title
	} else {
		// default to General if we cannot find the folder
		elements[0].FolderName = "General"
	}

	return elements[0], nil
}

// createLibraryElement adds a library element.
func (l *LibraryElementService) CreateElement(c context.Context, signedInUser identity.Requester, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error) {
	if err := l.requireSupportedElementKind(cmd.Kind); err != nil {
		return model.LibraryElementDTO{}, err
	}
	createUID := cmd.UID
	if len(createUID) == 0 {
		createUID = util.GenerateShortUID()
	} else {
		if !util.IsValidShortUID(createUID) {
			return model.LibraryElementDTO{}, model.ErrLibraryElementInvalidUID
		} else if util.IsShortUIDTooLong(createUID) {
			return model.LibraryElementDTO{}, model.ErrLibraryElementUIDTooLong
		}
	}

	if cmd.FolderUID != nil && l.folderService != nil {
		f, err := l.folderService.Get(c, &folder.GetFolderQuery{
			OrgID:        signedInUser.GetOrgID(),
			UID:          cmd.FolderUID,
			SignedInUser: signedInUser,
		})
		if err != nil {
			return model.LibraryElementDTO{}, err
		}
		if f.ManagedBy == utils.ManagerKindRepo {
			return model.LibraryElementDTO{}, model.ErrLibraryElementProvisionedFolder
		}
	}

	updatedModel := cmd.Model
	var err error
	if cmd.Kind == int64(model.PanelElement) {
		updatedModel, err = l.addUidToLibraryPanel(cmd.Model, createUID)
		if err != nil {
			return model.LibraryElementDTO{}, err
		}
	}

	var userID int64
	if id, err := identity.UserIdentifier(signedInUser.GetID()); err == nil {
		userID = id
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// folderUID *string will be changed to string
	var folderUID = ""
	if cmd.FolderUID != nil {
		folderUID = *cmd.FolderUID
	}
	element := model.LibraryElement{
		OrgID:     signedInUser.GetOrgID(),
		FolderID:  cmd.FolderID, // nolint:staticcheck
		FolderUID: folderUID,
		UID:       createUID,
		Name:      cmd.Name,
		Model:     updatedModel,
		Version:   1,
		Kind:      cmd.Kind,

		Created: time.Now(),
		Updated: time.Now(),

		CreatedBy: userID,
		UpdatedBy: userID,
	}

	if err := syncFieldsWithModel(&element); err != nil {
		return model.LibraryElementDTO{}, err
	}

	err = l.SQLStore.WithTransactionalDbSession(c, func(session *db.Session) error {
		allowed, err := l.AccessControl.Evaluate(c, signedInUser, ac.EvalPermission(ActionLibraryPanelsCreate, folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)))
		if !allowed {
			return fmt.Errorf("%w: folder UID '%s'", model.ErrLibraryElementInsufficientPermissions, folderUID)
		}
		if err != nil {
			return err
		}
		if _, err := session.Insert(&element); err != nil {
			if l.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
				return model.ErrLibraryElementAlreadyExists
			}
			return err
		}
		return nil
	})

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	dto := model.LibraryElementDTO{
		ID:          element.ID,
		OrgID:       element.OrgID,
		FolderID:    element.FolderID, // nolint:staticcheck
		UID:         element.UID,
		Name:        element.Name,
		Kind:        element.Kind,
		Type:        element.Type,
		Description: element.Description,
		Model:       element.Model,
		Version:     element.Version,
		Meta: model.LibraryElementDTOMeta{
			ConnectedDashboards: 0,
			Created:             element.Created,
			Updated:             element.Updated,
			CreatedBy: model.LibraryElementDTOMetaUser{
				Id:        element.CreatedBy,
				Name:      signedInUser.GetLogin(),
				AvatarUrl: dtos.GetGravatarUrl(l.Cfg, signedInUser.GetEmail()),
			},
			UpdatedBy: model.LibraryElementDTOMetaUser{
				Id:        element.UpdatedBy,
				Name:      signedInUser.GetLogin(),
				AvatarUrl: dtos.GetGravatarUrl(l.Cfg, signedInUser.GetEmail()),
			},
		},
	}

	return dto, err
}

// deleteLibraryElement deletes a library element.
func (l *LibraryElementService) DeleteLibraryElement(c context.Context, signedInUser identity.Requester, uid string) (int64, error) {
	var elementID int64
	err := l.SQLStore.WithTransactionalDbSession(c, func(session *db.Session) error {
		element, err := l.GetLibraryElement(c, signedInUser, session, uid)
		if err != nil {
			return err
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()

		// Check for connected dashboards via search, using a service identity so we see
		// all dashboards regardless of the calling user's folder permissions
		serviceCtx, _ := identity.WithServiceIdentity(c, signedInUser.GetOrgID())
		connectedDashboards, err := l.dashboardsService.GetDashboardsByLibraryPanelUID(serviceCtx, uid, signedInUser.GetOrgID())
		if err != nil {
			return err
		}
		if len(connectedDashboards) > 0 {
			return model.ErrLibraryElementHasConnections
		}

		result, err := session.Exec("DELETE FROM library_element WHERE id=?", element.ID)
		if err != nil {
			return err
		}
		if rowsAffected, err := result.RowsAffected(); err != nil {
			return err
		} else if rowsAffected != 1 {
			return model.ErrLibraryElementNotFound
		}

		elementID = element.ID
		return nil
	})
	return elementID, err
}

// getLibraryElements gets a Library Element where param == value
// tree can be nil, in which case folder info will be fetched individually
func (l *LibraryElementService) getLibraryElements(c context.Context, store db.DB, cfg *setting.Cfg, signedInUser identity.Requester, params []Pair, features featuremgmt.FeatureToggles, cmd model.GetLibraryElementCommand, tree *folder.FolderTree) ([]model.LibraryElementDTO, error) {
	if len(params) < 1 {
		return nil, fmt.Errorf("expected at least one parameter pair")
	}
	libraryElements := make([]model.LibraryElementWithMeta, 0)

	recursiveQueriesAreSupported, err := store.RecursiveQueriesAreSupported()
	if err != nil {
		return nil, err
	}

	err = store.WithDbSession(c, func(session *db.Session) error {
		builder := db.NewSqlBuilder(cfg, features, store.GetDialect(), recursiveQueriesAreSupported)
		builder.Write(selectLibraryElementDTOWithMeta)
		builder.Write(getFromLibraryElementDTOWithMeta(store.GetDialect()))
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()

		builder.Write(" WHERE ")
		// nolint:staticcheck
		writeParamSelectorSQL(&builder, append(params, Pair{"folder_id", cmd.FolderID})...)

		builder.Write(" OR le.folder_id <> 0 AND ")
		writeParamSelectorSQL(&builder, params...)

		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&libraryElements); err != nil {
			return err
		}
		if len(libraryElements) == 0 {
			return model.ErrLibraryElementNotFound
		}

		return nil
	})
	if err != nil {
		return []model.LibraryElementDTO{}, err
	}

	leDtos := make([]model.LibraryElementDTO, len(libraryElements))
	for i, libraryElement := range libraryElements {
		var folderUID, folderTitle string
		var cacheHit bool
		if tree != nil {
			var fd folder.FolderNode
			fd, cacheHit = tree.GetByID(libraryElement.FolderID) // nolint:staticcheck
			if cacheHit {
				folderTitle = fd.Title
				folderUID = fd.UID
			}
		}
		// Fetch folder from service if tree is nil, or if it doesn't have the folder info (e.g. due to a recent creation)
		if tree == nil || !cacheHit {
			// nolint:staticcheck
			f, err := l.folderService.Get(c, &folder.GetFolderQuery{OrgID: signedInUser.GetOrgID(), ID: &libraryElement.FolderID, SignedInUser: signedInUser})
			if err != nil {
				return []model.LibraryElementDTO{}, err
			}
			folderTitle = f.Title
			folderUID = f.UID
			if f.ID == 0 { // nolint:staticcheck
				folderUID = ac.GeneralFolderUID
			}
		}
		var updatedModel json.RawMessage
		if libraryElement.Kind == int64(model.PanelElement) {
			updatedModel, err = l.addUidToLibraryPanel(libraryElement.Model, libraryElement.UID)
			if err != nil {
				return []model.LibraryElementDTO{}, err
			}
		}

		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		leDtos[i] = model.LibraryElementDTO{
			ID:          libraryElement.ID,
			OrgID:       libraryElement.OrgID,
			FolderID:    libraryElement.FolderID, // nolint:staticcheck
			FolderUID:   folderUID,
			UID:         libraryElement.UID,
			Name:        libraryElement.Name,
			Kind:        libraryElement.Kind,
			Type:        libraryElement.Type,
			Description: libraryElement.Description,
			Model:       updatedModel,
			Version:     libraryElement.Version,
			Meta: model.LibraryElementDTOMeta{
				FolderName:          folderTitle,
				FolderUID:           folderUID,
				ConnectedDashboards: libraryElement.ConnectedDashboards,
				Created:             libraryElement.Created,
				Updated:             libraryElement.Updated,
				CreatedBy: model.LibraryElementDTOMetaUser{
					Id:        libraryElement.CreatedBy,
					Name:      libraryElement.CreatedByName,
					AvatarUrl: dtos.GetGravatarUrl(l.Cfg, libraryElement.CreatedByEmail),
				},
				UpdatedBy: model.LibraryElementDTOMetaUser{
					Id:        libraryElement.UpdatedBy,
					Name:      libraryElement.UpdatedByName,
					AvatarUrl: dtos.GetGravatarUrl(l.Cfg, libraryElement.UpdatedByEmail),
				},
			},
		}
	}

	if err := l.enrichConnectedDashboards(c, signedInUser.GetOrgID(), leDtos); err != nil {
		return nil, err
	}

	return leDtos, nil
}

// getLibraryElementByUid gets a Library Element by uid.
// tree can be nil, in which case folder info will be fetched individually
func (l *LibraryElementService) getLibraryElementByUid(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand, tree *folder.FolderTree) (model.LibraryElementDTO, error) {
	libraryElements, err := l.getLibraryElements(c, l.SQLStore, l.Cfg, signedInUser, []Pair{{key: "org_id", value: signedInUser.GetOrgID()}, {key: "uid", value: cmd.UID}}, l.features, cmd, tree)
	if err != nil {
		return model.LibraryElementDTO{}, err
	}
	if len(libraryElements) > 1 {
		return model.LibraryElementDTO{}, fmt.Errorf("found %d elements, while expecting at most one", len(libraryElements))
	}

	return libraryElements[0], nil
}

// getLibraryElementByName gets a Library Element by name.
func (l *LibraryElementService) getLibraryElementsByName(c context.Context, signedInUser identity.Requester, name string) ([]model.LibraryElementDTO, error) {
	return l.getLibraryElements(c, l.SQLStore, l.Cfg, signedInUser, []Pair{{"org_id", signedInUser.GetOrgID()}, {"name", name}}, l.features, model.GetLibraryElementCommand{
		FolderName: dashboards.RootFolderName,
		Name:       name,
	}, nil)
}

// getAllLibraryElements gets all Library Elements.
func (l *LibraryElementService) getAllLibraryElements(c context.Context, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) (model.LibraryElementSearchResult, error) {
	elements := make([]model.LibraryElementWithMeta, 0)
	result := model.LibraryElementSearchResult{}

	recursiveQueriesAreSupported, err := l.SQLStore.RecursiveQueriesAreSupported()
	if err != nil {
		return result, err
	}

	if query.PerPage <= 0 {
		query.PerPage = 100
	}
	if query.Page <= 0 {
		query.Page = 1
	}
	var typeFilter []string
	if len(strings.TrimSpace(query.TypeFilter)) > 0 {
		typeFilter = strings.Split(query.TypeFilter, ",")
	}
	folderFilter := parseFolderFilter(query)
	if folderFilter.parseError != nil {
		return model.LibraryElementSearchResult{}, folderFilter.parseError
	}

	foldersWithMatchingTitles, err := getFoldersWithMatchingTitles(c, l, signedInUser, query)
	if err != nil {
		return model.LibraryElementSearchResult{}, err
	}
	retDTOs := make([]model.LibraryElementDTO, 0)
	err = l.SQLStore.WithDbSession(c, func(session *db.Session) error {
		builder := db.NewSqlBuilder(l.Cfg, l.features, l.SQLStore.GetDialect(), recursiveQueriesAreSupported)
		if folderFilter.includeGeneralFolder {
			builder.Write(selectLibraryElementDTOWithMeta)
			builder.Write(", '' as folder_uid ")
			builder.Write(getFromLibraryElementDTOWithMeta(l.SQLStore.GetDialect()))
			builder.Write(` WHERE le.org_id=?  AND le.folder_id=0`, signedInUser.GetOrgID())
			writeKindSQL(query, &builder)
			writeSearchStringSQL(query, l.SQLStore, &builder, foldersWithMatchingTitles)
			writeExcludeSQL(query, &builder)
			writeTypeFilterSQL(typeFilter, &builder)
			builder.Write(" ")
			builder.Write(l.SQLStore.GetDialect().UnionDistinct())
			builder.Write(" ")
		}
		builder.Write(selectLibraryElementDTOWithMeta)
		builder.Write(", le.folder_uid as folder_uid ")
		builder.Write(getFromLibraryElementDTOWithMeta(l.SQLStore.GetDialect()))
		builder.Write(` WHERE le.org_id=? AND le.folder_id<>0`, signedInUser.GetOrgID())
		writeKindSQL(query, &builder)
		writeSearchStringSQL(query, l.SQLStore, &builder, foldersWithMatchingTitles)
		writeExcludeSQL(query, &builder)
		writeTypeFilterSQL(typeFilter, &builder)
		if err := folderFilter.writeFolderFilterSQL(false, &builder); err != nil {
			return err
		}
		if query.SortDirection == sort.SortAlphaDesc.Name {
			builder.Write(" ORDER BY 1 DESC")
		} else {
			builder.Write(" ORDER BY 1 ASC")
		}
		writePerPageSQL(query, l.SQLStore, &builder)
		if err := session.SQL(builder.GetSQLString(), builder.GetParams()...).Find(&elements); err != nil {
			return err
		}

		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		needsFolderTree := !query.SkipFolderTreeForAdmin || !signedInUser.HasRole(org.RoleAdmin)
		var folderTree *folder.FolderTree
		if needsFolderTree {
			// Get the folder tree filtered by user permissions (cached per user per request)
			folderTree, err = l.treeCache.get(c, signedInUser)
			if err != nil {
				return err
			}
		}

		// Filter elements based on folder access using the tree
		for _, element := range elements {
			if !signedInUser.HasRole(org.RoleAdmin) {
				if !folderTree.Contains(element.FolderUID) {
					continue
				}
			}
			var title string
			if needsFolderTree {
				title = folderTree.GetTitle(element.FolderUID)
				if title == "" {
					title = dashboards.RootFolderName
				}
			}
			retDTOs = append(retDTOs, model.LibraryElementDTO{
				ID:          element.ID,
				OrgID:       element.OrgID,
				FolderID:    element.FolderID, // nolint:staticcheck
				FolderUID:   element.FolderUID,
				UID:         element.UID,
				Name:        element.Name,
				Kind:        element.Kind,
				Type:        element.Type,
				Description: element.Description,
				Model:       element.Model,
				Version:     element.Version,
				Meta: model.LibraryElementDTOMeta{
					FolderName:          title,
					FolderUID:           element.FolderUID,
					ConnectedDashboards: element.ConnectedDashboards,
					Created:             element.Created,
					Updated:             element.Updated,
					CreatedBy: model.LibraryElementDTOMetaUser{
						Id:        element.CreatedBy,
						Name:      element.CreatedByName,
						AvatarUrl: dtos.GetGravatarUrl(l.Cfg, element.CreatedByEmail),
					},
					UpdatedBy: model.LibraryElementDTOMetaUser{
						Id:        element.UpdatedBy,
						Name:      element.UpdatedByName,
						AvatarUrl: dtos.GetGravatarUrl(l.Cfg, element.UpdatedByEmail),
					},
				},
			})
		}

		var libraryElements []model.LibraryElementWithMeta
		countBuilder := db.SQLBuilder{}
		if folderFilter.includeGeneralFolder {
			countBuilder.Write(selectLibraryElementDTOWithMeta)
			countBuilder.Write(", '' as folder_uid ")
			countBuilder.Write(getFromLibraryElementDTOWithMeta(l.SQLStore.GetDialect()))
			countBuilder.Write(` WHERE le.org_id=? AND le.folder_id=0`, signedInUser.GetOrgID())
			writeKindSQL(query, &countBuilder)
			writeSearchStringSQL(query, l.SQLStore, &countBuilder, foldersWithMatchingTitles)
			writeExcludeSQL(query, &countBuilder)
			writeTypeFilterSQL(typeFilter, &countBuilder)
			countBuilder.Write(" ")
			countBuilder.Write(l.SQLStore.GetDialect().UnionDistinct())
			countBuilder.Write(" ")
		}
		countBuilder.Write(selectLibraryElementDTOWithMeta)
		countBuilder.Write(", le.folder_uid as folder_uid ")
		countBuilder.Write(getFromLibraryElementDTOWithMeta(l.SQLStore.GetDialect()))
		countBuilder.Write(` WHERE le.org_id=? AND le.folder_id<>0`, signedInUser.GetOrgID())
		writeKindSQL(query, &countBuilder)
		writeSearchStringSQL(query, l.SQLStore, &countBuilder, foldersWithMatchingTitles)
		writeExcludeSQL(query, &countBuilder)
		writeTypeFilterSQL(typeFilter, &countBuilder)
		if err := folderFilter.writeFolderFilterSQL(true, &countBuilder); err != nil {
			return err
		}
		if err := session.SQL(countBuilder.GetSQLString(), countBuilder.GetParams()...).Find(&libraryElements); err != nil {
			return err
		}

		// Apply the same folder permission filtering to the count for non-admin users
		totalCount := int64(len(libraryElements))
		if !signedInUser.HasRole(org.RoleAdmin) {
			totalCount = 0
			for _, element := range libraryElements {
				if folderTree.Contains(element.FolderUID) {
					totalCount++
				}
			}
		}

		result = model.LibraryElementSearchResult{
			TotalCount: totalCount,
			Elements:   retDTOs,
			Page:       query.Page,
			PerPage:    query.PerPage,
		}

		return nil
	})
	if err != nil {
		return result, err
	}

	if err := l.enrichConnectedDashboards(c, signedInUser.GetOrgID(), result.Elements); err != nil {
		return result, err
	}

	return result, nil
}

func (l *LibraryElementService) handleFolderIDPatches(ctx context.Context, elementToPatch *model.LibraryElement,
	fromFolderID int64, toFolderID int64, user identity.Requester) error {
	// FolderID was not provided in the PATCH request
	if toFolderID == -1 {
		toFolderID = fromFolderID
	}

	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
	// nolint:staticcheck
	elementToPatch.FolderID = toFolderID

	return nil
}

// patchLibraryElement updates a Library Element.
func (l *LibraryElementService) PatchLibraryElement(c context.Context, signedInUser identity.Requester, cmd model.PatchLibraryElementCommand, uid string) (model.LibraryElementDTO, error) {
	var dto model.LibraryElementDTO
	if err := l.requireSupportedElementKind(cmd.Kind); err != nil {
		return model.LibraryElementDTO{}, err
	}

	if cmd.FolderUID != nil {
		f, err := l.folderService.Get(c, &folder.GetFolderQuery{
			OrgID:        signedInUser.GetOrgID(),
			UID:          cmd.FolderUID,
			SignedInUser: signedInUser,
		})
		if err != nil {
			return model.LibraryElementDTO{}, err
		}
		if f.ManagedBy == utils.ManagerKindRepo {
			return model.LibraryElementDTO{}, model.ErrLibraryElementProvisionedFolder
		}
	}

	err := l.SQLStore.WithTransactionalDbSession(c, func(session *db.Session) error {
		elementInDB, err := l.GetLibraryElement(c, signedInUser, session, uid)
		if err != nil {
			return err
		}
		if elementInDB.Version != cmd.Version {
			return model.ErrLibraryElementVersionMismatch
		}
		updateUID := cmd.UID
		if len(updateUID) == 0 {
			updateUID = uid
		} else if updateUID != uid {
			if !util.IsValidShortUID(updateUID) {
				return model.ErrLibraryElementInvalidUID
			} else if util.IsShortUIDTooLong(updateUID) {
				return model.ErrLibraryElementUIDTooLong
			}

			_, err := l.GetLibraryElement(c, signedInUser, session, updateUID)
			if !errors.Is(err, model.ErrLibraryElementNotFound) {
				return model.ErrLibraryElementAlreadyExists
			}
		}

		var userID int64
		if id, err := identity.UserIdentifier(signedInUser.GetID()); err == nil {
			userID = id
		}

		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		var libraryElement = model.LibraryElement{
			ID:          elementInDB.ID,
			OrgID:       signedInUser.GetOrgID(),
			FolderID:    cmd.FolderID, // nolint:staticcheck
			UID:         updateUID,
			Name:        cmd.Name,
			Kind:        elementInDB.Kind,
			Type:        elementInDB.Type,
			Description: elementInDB.Description,
			Model:       cmd.Model,
			Version:     elementInDB.Version + 1,
			Created:     elementInDB.Created,
			CreatedBy:   elementInDB.CreatedBy,
			Updated:     time.Now(),
			UpdatedBy:   userID,
		}

		if cmd.Name == "" {
			libraryElement.Name = elementInDB.Name
		}
		if cmd.Model == nil {
			libraryElement.Model = elementInDB.Model
		}
		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		// nolint:staticcheck
		if err := l.handleFolderIDPatches(c, &libraryElement, elementInDB.FolderID, cmd.FolderID, signedInUser); err != nil {
			return err
		}
		// Keep folder_uid in sync with folder_id: getAllLibraryElements reads folder_uid
		// directly from the table, so leaving it stale causes the list view to diverge.
		// FolderID is authoritative here (set by handleFolderIDPatches); derive FolderUID
		// from it so PATCHes that don't touch the folder still heal any prior drift.
		folderID := libraryElement.FolderID // nolint:staticcheck
		if folderID == 0 {
			libraryElement.FolderUID = ""
		} else {
			f, err := l.folderService.Get(c, &folder.GetFolderQuery{
				OrgID:        signedInUser.GetOrgID(),
				ID:           &folderID,
				SignedInUser: signedInUser,
			})
			if err != nil {
				return err
			}
			libraryElement.FolderUID = f.UID
		}
		if err := syncFieldsWithModel(&libraryElement); err != nil {
			return err
		}
		if rowsAffected, err := session.ID(elementInDB.ID).MustCols("folder_id", "folder_uid").Update(&libraryElement); err != nil {
			if l.SQLStore.GetDialect().IsUniqueConstraintViolation(err) {
				return model.ErrLibraryElementAlreadyExists
			}
			return err
		} else if rowsAffected != 1 {
			return model.ErrLibraryElementNotFound
		}

		metrics.MFolderIDsServiceCount.WithLabelValues(metrics.LibraryElements).Inc()
		dto = model.LibraryElementDTO{
			ID:          libraryElement.ID,
			OrgID:       libraryElement.OrgID,
			FolderID:    libraryElement.FolderID, // nolint:staticcheck
			UID:         libraryElement.UID,
			Name:        libraryElement.Name,
			Kind:        libraryElement.Kind,
			Type:        libraryElement.Type,
			Description: libraryElement.Description,
			Model:       libraryElement.Model,
			Version:     libraryElement.Version,
			Meta: model.LibraryElementDTOMeta{
				ConnectedDashboards: elementInDB.ConnectedDashboards,
				Created:             libraryElement.Created,
				Updated:             libraryElement.Updated,
				CreatedBy: model.LibraryElementDTOMetaUser{
					Id:        elementInDB.CreatedBy,
					Name:      elementInDB.CreatedByName,
					AvatarUrl: dtos.GetGravatarUrl(l.Cfg, elementInDB.CreatedByEmail),
				},
				UpdatedBy: model.LibraryElementDTOMetaUser{
					Id:        libraryElement.UpdatedBy,
					Name:      signedInUser.GetLogin(),
					AvatarUrl: dtos.GetGravatarUrl(l.Cfg, signedInUser.GetEmail()),
				},
			},
		}
		return nil
	})

	if err != nil {
		return model.LibraryElementDTO{}, err
	}

	dtos := []model.LibraryElementDTO{dto}
	enrichErr := l.enrichConnectedDashboards(c, signedInUser.GetOrgID(), dtos)
	// do not return the error, just log it, because at this point, the patch has succeeded
	if enrichErr != nil {
		l.log.Warn("Failed to enrich connected dashboards for library element", "uid", dto.UID, "error", enrichErr)
	} else {
		dto = dtos[0]
	}

	return dto, nil
}

// deleteLibraryElementsInFolderUID deletes all Library Elements in a folder.
func (l *LibraryElementService) deleteLibraryElementsInFolderUID(c context.Context, signedInUser identity.Requester, folderUID string) error {
	if err := l.requireEditPermissionsOnFolderUID(c, signedInUser, folderUID); err != nil {
		if errors.Is(err, dashboards.ErrDashboardNotFound) {
			return dashboards.ErrFolderNotFound
		}
		return err
	}

	var elements []struct {
		UID string `xorm:"uid"`
	}
	err := l.SQLStore.WithDbSession(c, func(session *db.Session) error {
		return session.SQL("SELECT uid FROM library_element WHERE folder_uid=? AND org_id=?", folderUID, signedInUser.GetOrgID()).Find(&elements)
	})
	if err != nil {
		return err
	}

	serviceCtx, _ := identity.WithServiceIdentity(c, signedInUser.GetOrgID())
	for _, elem := range elements {
		connectedDashboards, err := l.dashboardsService.GetDashboardsByLibraryPanelUID(serviceCtx, elem.UID, signedInUser.GetOrgID())
		if err != nil {
			return err
		}
		if len(connectedDashboards) > 0 {
			return model.ErrFolderHasConnectedLibraryElements
		}
	}

	return l.SQLStore.WithTransactionalDbSession(c, func(session *db.Session) error {
		if _, err := session.Exec("DELETE FROM library_element WHERE folder_uid=? AND org_id=?", folderUID, signedInUser.GetOrgID()); err != nil {
			return err
		}

		return nil
	})
}

func getFoldersWithMatchingTitles(c context.Context, l *LibraryElementService, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) ([]string, error) {
	if len(strings.TrimSpace(query.SearchString)) <= 0 {
		return nil, nil
	}

	searchQuery := folder.SearchFoldersQuery{
		OrgID:        signedInUser.GetOrgID(),
		Title:        query.SearchString,
		SignedInUser: signedInUser,
	}

	folderHits, err := l.folderService.SearchFolders(c, searchQuery)
	if err != nil {
		return nil, err
	}

	foldersWithMatchingTitles := make([]string, 0, len(folderHits))
	for _, hit := range folderHits {
		foldersWithMatchingTitles = append(foldersWithMatchingTitles, hit.UID)
	}
	return foldersWithMatchingTitles, nil
}

// enrichConnectedDashboards populates the ConnectedDashboards count on each
// DTO by querying unified search.
func (l *LibraryElementService) enrichConnectedDashboards(ctx context.Context, orgID int64, dtos []model.LibraryElementDTO) error {
	serviceCtx, _ := identity.WithServiceIdentity(ctx, orgID)
	for i := range dtos {
		dashboards, err := l.dashboardsService.GetDashboardsByLibraryPanelUID(serviceCtx, dtos[i].UID, orgID)
		if err != nil {
			return err
		}
		dtos[i].Meta.ConnectedDashboards = int64(len(dashboards))
	}
	return nil
}
