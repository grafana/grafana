package entity

// The admin request is a superset of write request features
func ToAdminWriteEntityRequest(req *WriteEntityRequest) *AdminWriteEntityRequest {
	return &AdminWriteEntityRequest{
		GRN:             req.GRN,
		Body:            req.Body,
		Folder:          req.Folder,
		Comment:         req.Comment,
		PreviousVersion: req.PreviousVersion,
	}
}
