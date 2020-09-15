package models

type IsSAMLEnabledCommand struct {
	Result bool
}

type SAMLSingleLogout interface {
	SingleLogout(c *ReqContext) error
}
