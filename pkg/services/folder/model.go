package folder

import "time"

type Folder struct {
	ID          int64
	UID         string
	Title       string
	Description string
	URL         string

	Created time.Time
	Updated time.Time

	UpdatedBy int64
	CreatedBy int64
	HasACL    bool
}

// NewFolder tales a title and returns a Folder with the Created and Updated
// fields set to the current time.
func NewFolder(title string, description string) *Folder {
	return &Folder{
		Title:       title,
		Description: description,
		Created:     time.Now(),
		Updated:     time.Now(),
	}
}

// UpdateFolderCommand captures the information required by the folder service
// to update a folder.
type UpdateFolderCommand struct {
	Folder      *Folder `json:"folder"` // The extant folder
	UID         string  `json:"uid"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Version     int     `json:"version"`
	Overwrite   bool    `json:"overwrite"`
}

// CreateFolderCommand captures the information required by the folder service
// to create a folder.
type CreateFolderCommand struct {
	OrgID       int    `json:"org_id"`
	UID         string `json:"uid"`
	Title       string `json:"title"`
	Description string `json:"description"`
	ParentUID   string `json:"parent_uid"`
}

// MoveFolderCommand captures the information required by the folder service
// to move a folder.
type MoveFolderCommand struct {
	OrgID        int    `json:"org_id"`
	UID          string `json:"uid"`
	NewParentUID string `json:"new_parent_uid"`
}
