package fake

import (
	"context"
	"sync"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/libraryelements"
	"github.com/grafana/grafana/pkg/services/libraryelements/model"
	"github.com/grafana/grafana/pkg/util"
)

// LibraryElementService is a fake with only the required methods implemented while the others are stubbed.
type LibraryElementService struct {
	elements  map[string]model.LibraryElementDTO
	mx        sync.RWMutex
	idCounter int64
}

var _ libraryelements.Service = (*LibraryElementService)(nil)

func (l *LibraryElementService) CreateElement(c context.Context, signedInUser identity.Requester, cmd model.CreateLibraryElementCommand) (model.LibraryElementDTO, error) {
	l.mx.Lock()
	defer l.mx.Unlock()

	if len(l.elements) == 0 {
		l.elements = make(map[string]model.LibraryElementDTO, 0)
	}

	var orgID int64 = 1
	if signedInOrgID := signedInUser.GetOrgID(); signedInOrgID != 0 {
		orgID = signedInOrgID
	}

	var folderUID string
	if cmd.FolderUID != nil {
		folderUID = *cmd.FolderUID
	}

	createUID := cmd.UID
	if len(createUID) == 0 {
		createUID = util.GenerateShortUID()
	}

	if _, exists := l.elements[createUID]; exists {
		return model.LibraryElementDTO{}, model.ErrLibraryElementAlreadyExists
	}

	l.idCounter++

	dto := model.LibraryElementDTO{
		ID:          l.idCounter,
		OrgID:       orgID,
		FolderID:    cmd.FolderID, //nolint: staticcheck
		FolderUID:   folderUID,
		UID:         createUID,
		Name:        cmd.Name,
		Kind:        cmd.Kind,
		Type:        "text",
		Description: "A description",
		Model:       cmd.Model,
		Version:     1,
		Meta:        model.LibraryElementDTOMeta{},
	}

	l.elements[createUID] = dto

	return dto, nil
}

func (l *LibraryElementService) GetElement(c context.Context, signedInUser identity.Requester, cmd model.GetLibraryElementCommand) (model.LibraryElementDTO, error) {
	l.mx.RLock()
	defer l.mx.RUnlock()

	libraryElement, exists := l.elements[cmd.UID]
	if !exists {
		return model.LibraryElementDTO{}, model.ErrLibraryElementNotFound
	}

	return libraryElement, nil
}

func (l *LibraryElementService) GetElementsForDashboard(c context.Context, dashboardID int64) (map[string]model.LibraryElementDTO, error) {
	return map[string]model.LibraryElementDTO{}, nil
}

func (l *LibraryElementService) ConnectElementsToDashboard(c context.Context, signedInUser identity.Requester, elementUIDs []string, dashboardID int64) error {
	return nil
}

func (l *LibraryElementService) DisconnectElementsFromDashboard(c context.Context, dashboardID int64) error {
	return nil
}

func (l *LibraryElementService) DeleteLibraryElementsInFolder(c context.Context, signedInUser identity.Requester, folderUID string) error {
	return nil
}

func (l *LibraryElementService) GetAllElements(c context.Context, signedInUser identity.Requester, query model.SearchLibraryElementsQuery) (model.LibraryElementSearchResult, error) {
	elements := make([]model.LibraryElementDTO, 0, len(l.elements))

	var orgID int64 = 1
	if signedInOrgID := signedInUser.GetOrgID(); signedInOrgID != 0 {
		orgID = signedInOrgID
	}

	l.mx.RLock()
	defer l.mx.RUnlock()

	for _, element := range l.elements {
		if element.OrgID != orgID {
			continue
		}

		elements = append(elements, element)
	}

	// For this fake ignore pagination to make it simpler.
	return model.LibraryElementSearchResult{
		TotalCount: int64(len(elements)),
		Elements:   elements,
		Page:       1,
		PerPage:    len(elements),
	}, nil
}
