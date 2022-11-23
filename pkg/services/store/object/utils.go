package object

// The admin request is a superset of write request features
func ToAdminWriteObjectRequest(req *WriteObjectRequest) *AdminWriteObjectRequest {
	return &AdminWriteObjectRequest{
		GRN:             req.GRN,
		Body:            req.Body,
		Comment:         req.Comment,
		PreviousVersion: req.PreviousVersion,
	}
}
