package sqltemplate

// Args keeps the data that needs to be passed to the engine for execution in
// the right order. Add it to your data types passed to SQLTemplate, either by
// embedding or with a named struct field if its method Arg would clash with
// other fields.
// Example:
//
//	type DeleteQueryData struct {
//		*Args // pointer since we need to change it
//
//		ID int
//	}
//
//	deleteTmpl := template.Must(`DELETE FROM mytab WHERE id = {{ .Arg .ID }};`)
//
//	data := DeleteQueryData{
//		Dialect: SQLite,
//		Args: new(Args),
//		ID: 1,
//	}
//
//	query, err := deleteTmpl.Execute(data)
//	// check err here
//
//	// at this point, query will now be the string:
//	//	DELETE FROM mytab WHERE id = ?
//	// Which is not much for this simple example, but what we got though is the
//	// arguments populated into data.Args in the order needed for execution.
//	// So even if the execution of the template always returns the same string,
//	// it will take care of putting every argument in the expected order. This
//	// greatly improves readability of the template code by allowing to refer to
//	// fields by name, while also improving the Go code by not having to keep
//	// track of what fields go first and last when passed for execution, and
//	// especially in the case of complex queries that may have conditional
//	// behaviour in their template.
//
//	// now can run the query and safely pass the arguments
//	db.ExecContext(ctx, query, data.Args...)
type Args []any

// Arg can be called from within templates to pass arguments to the SQL driver
// to use in the execution of the query. If you embed Args, then you can just
// call this method instead of ".TheArgsStructFieldName.Arg".
func (a *Args) Arg(x any) string {
	*a = append(*a, x)
	return "?"
}
