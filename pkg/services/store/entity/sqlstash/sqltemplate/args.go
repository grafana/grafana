package sqltemplate

// Args keeps the data that needs to be passed to the engine for execution in
// the right order. Add it to your data types passed to SQLTemplate, either by
// embedding or with a named struct field if its Arg method would clash with
// another struct field.
type Args []any

// Arg can be called from within templates to pass arguments to the SQL driver
// to use in the execution of the query.
func (a *Args) Arg(x any) string {
	*a = append(*a, x)
	return "?"
}

func (a *Args) GetArgs() Args {
	return *a
}
