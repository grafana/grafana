package librarypanels

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/models"
)

// LibraryPanel is the model for library panel definitions.
type LibraryPanel struct {
	Id       int64
	OrgId    int64
	FolderId int64
	Title    string
	Model    json.RawMessage

	Created time.Time
	Updated time.Time

	CreatedBy int64
	UpdatedBy int64
}

var (
	// errLibraryPanelAlreadyAdded is an error when you add a library panel that already exists.
	errLibraryPanelAlreadyAdded = fmt.Errorf("library panel with that title already exists")
	// errLibraryPanelNotFound is an error for an unknown library panel definition.
	errLibraryPanelNotFound = fmt.Errorf("could not find library panel definition")
)

// Commands

// addLibraryPanelCommand is the command for adding a LibraryPanel
type addLibraryPanelCommand struct {
	OrgId        int64                `json:"-"`
	FolderId     int64                `json:"folderId"`
	Title        string               `json:"title"`
	SignedInUser *models.SignedInUser `json:"-"`
	Model        json.RawMessage      `json:"model"`

	Result *LibraryPanel
}
