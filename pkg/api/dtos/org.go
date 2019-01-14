package dtos

type UpdateOrgForm struct {
	Name string `json:"name"`
	Tenantlabel string `json:"tenantlabel"`
	Tenantvalue string `json:"tenantvalue"`
}

type TenantInfo struct {
	HasLabel bool
	HasValue bool
}

type UpdateOrgAddressForm struct {
	Address1 string `json:"address1"`
	Address2 string `json:"address2"`
	City     string `json:"city"`
	ZipCode  string `json:"zipcode"`
	State    string `json:"state"`
	Country  string `json:"country"`
}
