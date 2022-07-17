package entity

type FolderBody struct {
	Items     []Entity // without body and limited meta
	NextToken string
}

// Where did it come from
type Folder struct {
	Entity

	Body FolderBody
}
