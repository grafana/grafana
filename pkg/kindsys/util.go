package kindsys

// Ptr returns a pointer to a value of an arbitrary type.
//
// This function is provided to compensate for Grafana's Go code generation that
// represents optional fields using pointers.
//
// Pointers are the only technically [correct, non-ambiguous] way of
// representing an optional field in Go's type system. However, Go does not
// allow taking the address of certain primitive types inline. That is,
// this is invalid Go code:
//
//	var str *string
//	str = &"colorless green ideas sleep furiously"
//
// This func allows making such declarations in a single line:
//
//	var str *string
//	str = kindsys.Ptr("colorless green ideas sleep furiously")
//
// [correct, non-ambiguous]: https://github.com/grafana/grok/issues/1
func Ptr[T any](v T) *T {
	return &v
}
