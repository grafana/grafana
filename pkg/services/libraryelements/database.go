package libraryelements

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
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

// createEntity adds a entity.
func (l *LibraryElementService) createEntity(c *models.ReqContext, cmd createLibraryElementCommand) (LibraryElementDTO, error) {
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
