package xkube

import "k8s.io/apimachinery/pkg/util/validation/field"

// ErrorLister is an interface compatible with errors that also returns a list of Kubernetes field errors.
type ErrorLister interface {
	error
	ErrorList() field.ErrorList
}
