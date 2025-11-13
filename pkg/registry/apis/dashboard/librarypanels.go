package dashboard

import (
	"context"
	"encoding/json"

	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
)

var _ schemaversion.LibraryPanelInfoProvider = (*libraryPanelInfoProvider)(nil)

type libraryPanelInfoProvider struct {
	libraryPanelService libraryelements.Service
}

func (l *libraryPanelInfoProvider) GetPanelModelByUID(ctx context.Context, uid string) (map[string]interface{}, error) {
	// Extract namespace info from context to get OrgID
	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		// If namespace info is not available, return nil
		return nil, nil
	}

	// Get identity from context, or create a service identity if not available
	user, err := identity.GetRequester(ctx)
	if err != nil {
		// Use service identity for background operations
		ctx, user = identity.WithServiceIdentity(ctx, nsInfo.OrgID)
	}

	// Get the library element by UID
	cmd := model.GetLibraryElementCommand{
		UID: uid,
	}
	element, err := l.libraryPanelService.GetElement(ctx, user, cmd)
	if err != nil {
		// If library panel not found or error, return nil
		return nil, nil
	}

	// Parse the model JSON into a map
	var panelModel map[string]interface{}
	if err := json.Unmarshal(element.Model, &panelModel); err != nil {
		// If parsing fails, return nil
		return nil, nil
	}

	return panelModel, nil
}
