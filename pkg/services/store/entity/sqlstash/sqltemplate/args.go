package sqltemplate

// Args keeps the data that needs to be passed to the engine for execution in
// the right order. Add it to your data types passed to SQLTemplate, either by
// embedding or with a named struct field if its method Arg would clash with
// other fields.
type Args []any

// Arg can be called from within templates to pass arguments to the SQL driver
// to use in the execution of the query. If you embed Args, then you can just
// call this method instead of ".TheArgsStructFieldName.Arg".
func (a *Args) Arg(x any) string {
	*a = append(*a, x)
	return "?"
}
