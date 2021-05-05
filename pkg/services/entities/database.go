package entities

import (
	"encoding/json"
	"time"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/util"
)

func syncFieldsWithModel(entity *Entity) error {
	var model map[string]interface{}
	if err := json.Unmarshal(entity.Model, &model); err != nil {
		return err
	}

	model["title"] = entity.Name
	if model["type"] != nil {
		entity.Type = model["type"].(string)
	} else {
		model["type"] = entity.Type
	}
	if model["description"] != nil {
		entity.Description = model["description"].(string)
	} else {
		model["description"] = entity.Description
	}
	syncedModel, err := json.Marshal(&model)
	if err != nil {
		return err
	}

	entity.Model = syncedModel

	return nil
}

// createEntity adds a entity.
func (e *EntityService) createEntity(c *models.ReqContext, cmd createEntityCommand, kind int) (EntityDTO, error) {
	entity := Entity{
		OrgID:    c.SignedInUser.OrgId,
		FolderID: cmd.FolderID,
		UID:      util.GenerateShortUID(),
		Name:     cmd.Name,
		Model:    cmd.Model,
		Version:  1,
		Kind:     EntityKind(kind),

		Created: time.Now(),
		Updated: time.Now(),

		CreatedBy: c.SignedInUser.UserId,
		UpdatedBy: c.SignedInUser.UserId,
	}

	if err := syncFieldsWithModel(&entity); err != nil {
		return EntityDTO{}, err
	}

	err := e.SQLStore.WithTransactionalDbSession(c.Context.Req.Context(), func(session *sqlstore.DBSession) error {
		if err := e.requirePermissionsOnFolder(c.SignedInUser, cmd.FolderID); err != nil {
			return err
		}
		if _, err := session.Insert(&entity); err != nil {
			if e.SQLStore.Dialect.IsUniqueConstraintViolation(err) {
				return errEntityAlreadyExists
			}
			return err
		}
		return nil
	})

	dto := EntityDTO{
		ID:          entity.ID,
		OrgID:       entity.OrgID,
		FolderID:    entity.FolderID,
		UID:         entity.UID,
		Name:        entity.Name,
		Type:        entity.Type,
		Description: entity.Description,
		Model:       entity.Model,
		Version:     entity.Version,
		Meta: EntityDTOMeta{
			ConnectedDashboards: 0,
			Created:             entity.Created,
			Updated:             entity.Updated,
			CreatedBy: EntityDTOMetaUser{
				ID:        entity.CreatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
			UpdatedBy: EntityDTOMetaUser{
				ID:        entity.UpdatedBy,
				Name:      c.SignedInUser.Login,
				AvatarUrl: dtos.GetGravatarUrl(c.SignedInUser.Email),
			},
		},
	}

	return dto, err
}
