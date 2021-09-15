package models

// LibraryElementKind is used for the kind of library element
type LibraryElementKind int

const (
	// PanelElement is used for library elements that are of the Panel kind
	PanelElement LibraryElementKind = iota + 1
	// VariableElement is used for library elements that are of the Variable kind
	VariableElement
)

const LibraryElementConnectionTableName = "library_element_connection"
