package entity

// The admin request is a superset of write request features
func ToAdminWriteEntityRequest(req *WriteEntityRequest) *AdminWriteEntityRequest {
	return &AdminWriteEntityRequest{
		Entity:          req.Entity,
		PreviousVersion: req.PreviousVersion,
	}
}
