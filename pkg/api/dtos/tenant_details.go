package dtos

// TenantDetails struct does not have all the attributes,
// feel free to add the other missing attributes when needed.
type TenantDetails struct {
	Type         string `json:"type"`
	Domain       string `json:"domain"`
	RssoTenantId string `json:"rsso_tenant_id"`
}
