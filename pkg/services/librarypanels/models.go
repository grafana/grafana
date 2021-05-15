package librarypanels

import (
	"errors"
)

var (
	// errLibraryPanelHeaderUIDMissing is an error for when a library panel header is missing the uid property.
	errLibraryPanelHeaderUIDMissing = errors.New("library panel header is missing required property uid")
	// errLibraryPanelHeaderNameMissing is an error for when a library panel header is missing the name property.
	errLibraryPanelHeaderNameMissing = errors.New("library panel header is missing required property name")
)
