package models

type AccessControl interface {
	// Evaluate evaluates access to the given resource
	Evaluate(ctx *ReqContext, user *User, permission string, scope ...string) (bool, error)
}
