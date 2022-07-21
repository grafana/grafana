package searchV2

import (
	"context"
	"encoding/json"
	"errors"
	"sort"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/datasources"
)

func (s *StandardSearchService) addAllowedActionsField(ctx context.Context, orgId int64, user *models.SignedInUser, response *backend.DataResponse) error {
	references, err := getEntityReferences(response)
	if err != nil {
		return err
	}

	allAllowedActions, err := s.createAllowedActions(ctx, orgId, user, references)
	if err != nil {
		return err
	}

	if len(response.Frames) == 0 {
		return errors.New("empty response")
	}

	frame := response.Frames[0]

	allowedActionsField := data.NewFieldFromFieldType(data.FieldTypeJSON, len(allAllowedActions))
	allowedActionsField.Name = "allowed_actions"
	frame.Fields = append(frame.Fields, allowedActionsField)

	for i, actions := range allAllowedActions {
		js, _ := json.Marshal(actions)
		jsb := json.RawMessage(js)
		allowedActionsField.Set(i, jsb)
	}

	return nil
}

type allowedActions struct {
	EntityType entityKind `json:"type"`
	UID        string     `json:"uid"`
	Actions    []string   `json:"actions"`
}

func (s *StandardSearchService) createAllowedActions(ctx context.Context, orgId int64, user *models.SignedInUser, references []entityReferences) ([][]allowedActions, error) {
	uidsPerType := make(map[entityKind][]string)
	for _, refs := range references {
		if _, ok := uidsPerType[refs.entityType]; !ok {
			uidsPerType[refs.entityType] = []string{}
		}

		uidsPerType[refs.entityType] = append(uidsPerType[refs.entityType], refs.uid)

		if len(refs.dsUids) > 0 {
			if _, ok := uidsPerType[entityKindDatasource]; !ok {
				uidsPerType[entityKindDatasource] = []string{}
			}

			uidsPerType[entityKindDatasource] = append(uidsPerType[entityKindDatasource], refs.dsUids...)
		}
	}

	allowedActionsByUid := make(map[entityKind]map[string][]string)

	for entType, uids := range uidsPerType {
		if entType == entityKindPanel {
			emptyAllowedActions := make(map[string][]string)
			for _, uid := range uids {
				emptyAllowedActions[uid] = []string{}
			}
			allowedActionsByUid[entityKindPanel] = emptyAllowedActions
		}

		var prefix string
		switch entType {
		case entityKindFolder:
			prefix = dashboards.ScopeFoldersPrefix
		case entityKindDatasource:
			prefix = datasources.ScopePrefix
		case entityKindDashboard:
			prefix = dashboards.ScopeDashboardsPrefix
		default:
			continue
		}

		allowedActionsByUid[entType] = s.getAllowedActionsByUid(ctx, user, orgId, prefix, uids)
	}

	dsActionsByUid, ok := allowedActionsByUid[entityKindDatasource]
	if !ok {
		dsActionsByUid = make(map[string][]string)
	}

	var out [][]allowedActions
	for _, ref := range references {
		var actions []allowedActions

		selfActions := make([]string, 0)
		if selfTypeActions, ok := allowedActionsByUid[ref.entityType]; ok {
			if self, ok := selfTypeActions[ref.uid]; ok && len(self) > 0 {
				selfActions = self
			}
		}

		actions = append(actions, allowedActions{
			EntityType: ref.entityType,
			UID:        ref.uid,
			Actions:    selfActions,
		})

		for _, dsUid := range ref.dsUids {
			dsActions := make([]string, 0)
			if dsAct, ok := dsActionsByUid[dsUid]; ok {
				dsActions = dsAct
			}

			actions = append(actions, allowedActions{
				EntityType: entityKindDatasource,
				UID:        dsUid,
				Actions:    dsActions,
			})
		}

		out = append(out, actions)
	}

	return out, nil
}

func (s *StandardSearchService) getAllowedActionsByUid(ctx context.Context, user *models.SignedInUser,
	orgID int64, prefix string, resourceIDs []string) map[string][]string {
	if s.ac.IsDisabled() {
		return map[string][]string{}
	}

	if user.Permissions == nil {
		return map[string][]string{}
	}

	permissions, ok := user.Permissions[orgID]
	if !ok {
		return map[string][]string{}
	}

	uidsAsMap := make(map[string]bool)
	for _, uid := range resourceIDs {
		uidsAsMap[uid] = true
	}

	out := make(map[string][]string)
	resp := accesscontrol.GetResourcesMetadata(ctx, permissions, prefix, uidsAsMap)
	for uid, meta := range resp {
		var actions []string
		for action := range meta {
			actions = append(actions, action)
		}
		sort.Strings(actions)
		out[uid] = actions
	}
	return out
}

type entityReferences struct {
	entityType entityKind
	uid        string
	dsUids     []string
}

func getEntityReferences(resp *backend.DataResponse) ([]entityReferences, error) {
	if resp == nil {
		return nil, errors.New("nil response")
	}

	if resp.Error != nil {
		return nil, resp.Error
	}

	if len(resp.Frames) == 0 {
		return nil, errors.New("empty response")
	}

	frame := resp.Frames[0]

	kindField, idx := frame.FieldByName("kind")
	if idx == -1 {
		return nil, errors.New("no kind field")
	}

	dsUidField, idx := frame.FieldByName("ds_uid")
	if idx == -1 {
		return nil, errors.New("no ds_uid field")
	}
	uidField, idx := frame.FieldByName("uid")
	if idx == -1 {
		return nil, errors.New("no dash_uid field")
	}

	if dsUidField.Len() != uidField.Len() {
		return nil, errors.New("mismatched lengths")
	}

	var out []entityReferences
	for i := 0; i < dsUidField.Len(); i++ {
		kind, ok := kindField.At(i).(string)
		if !ok || kind == "" {
			return nil, errors.New("invalid value in kind field")
		}

		uid, ok := uidField.At(i).(string)
		if !ok || uid == "" {
			return nil, errors.New("invalid value in uid field")
		}

		if entityKind(kind) != entityKindDashboard {
			out = append(out, entityReferences{
				entityType: entityKind(kind),
				uid:        uid,
			})
			continue
		}

		uidField, ok := uidField.At(i).(string)
		if !ok || uidField == "" {
			return nil, errors.New("invalid value in dash_uid field")
		}

		rawDsUids, ok := dsUidField.At(i).(*json.RawMessage)
		if !ok {
			return nil, errors.New("invalid value in ds_uid field")
		}

		var uids []string
		if rawDsUids != nil {
			jsonValue, err := rawDsUids.MarshalJSON()
			if err != nil {
				return nil, err
			}

			err = json.Unmarshal(jsonValue, &uids)
			if err != nil {
				return nil, err
			}
		}

		out = append(out, entityReferences{entityType: entityKindDashboard, uid: uid, dsUids: uids})
	}

	return out, nil
}
