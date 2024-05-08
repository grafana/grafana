package sqltemplate

import (
	"fmt"
	"strings"
	"text/template"
)

// This file contains runnable examples. They serve the purpose of providing
// idiomatic usage of the package as well as showing how it actually works,
// since the examples are actually run together with regular Go tests. Note that
// the "Output" comment section at the end of each function starting with
// "Example" is used by the standard Go test tool to check that the standard
// output of the function matches the commented text until the end of the
// function. If you change the function, you may need to adapt that comment
// section as it's possible that the output changes, causing it to fail tests.
// To learn more about Go's runnable tests, which are a core builtin feature of
// Go's standard testing library, see:
//	https://pkg.go.dev/testing#hdr-Examples

// In this example we will use both Args and Dialect to dynamically and securely
// build SQL queries, while also keeping track of the arguments that need to be
// passed to the database methods to replace the placeholder "?" with the
// correct values. If you're not familiar with Go text templating language,
// please, consider reading that library's documentation first.

// We will start with creating a simple text template to insert a new row into a
// users table:
var createUserTmpl = template.Must(template.New("query").Parse(`
    INSERT INTO users (id, {{ .Ident "type" }}, name)
        VALUES ({{ .Arg .ID }}, {{ .Arg .Type }}, {{ .Arg .Name}});
`))

// The two interesting methods here are Arg and Ident. Note that now we have a
// reusable text template, that will dynamically create the SQL code when
// executed, which is interesting because we have a SQL-implementation dependant
// code handled for us within the template (escaping the reserved word "type"),
// but also because the arguments to the database Exec method will be handled
// for us. The struct with the data needed to create a new user could be
// something like the following:
type CreateUserRequest struct {
	ID   int
	Name string
	Type string
}

// Note that this struct could actually come from a different definition, for
// example, from a DTO. We can reuse this DTO and create a smaller struct for
// the purpose of writing to the database without the need of mapping:
type DBCreateUserRequest struct {
	Dialect // provides access to all Dialect methods, like Ident
	*Args   // provides access to Arg method, to keep track of db arguments
	*CreateUserRequest
}

func Example() {
	// Finally, we can take a request received from a user like the following:
	dto := &CreateUserRequest{
		ID:   1,
		Name: "root",
		Type: "admin",
	}

	// Put it into a database request:
	req := DBCreateUserRequest{
		Dialect:           SQLite, // set at runtime, the template is agnostic
		Args:              new(Args),
		CreateUserRequest: dto,
	}

	// Then we finally execute the template to both generate the SQL code and to
	// populate req.Args with the arguments:
	var b strings.Builder
	err := createUserTmpl.Execute(&b, req)
	if err != nil {
		panic(err) // terminate the runnable example on error
	}

	// And we should finally be able to see the SQL generated, as well as
	// getting the arguments populated for execution in a database. To execute
	// it in the databse, we could run:
	//	db.ExecContext(ctx, b.String(), req.Args...)

	// To provide the runnable example with some code to test, we will now print
	// the values to standard output:
	fmt.Println(b.String())
	fmt.Printf("%#v", req.Args)

	// Output:
	//     INSERT INTO users (id, "type", name)
	//         VALUES (?, ?, ?);
	//
	// &sqltemplate.Args{1, "admin", "root"}
}

// A more complex template example follows, which should be self-explanatory
// given the previous example. It is left as an exercise to the reader how the
// code should be implemented, based on the ExampleCreateUser function.

// List users example.
var _ = template.Must(template.New("query").Parse(`
    SELECT id, {{ .Ident "type" }}, name
	    FROM users
		WHERE
			{{ if eq .By "type" }}
				{{ .Ident "type" }} = {{ .Arg .Value }}
			{{ else if eq .By "name" }}
				name LIKE {{ .Arg .Value }}
			{{ end }};
`))

type ListUsersRequest struct {
	By    string
	Value string
}

type DBListUsersRequest struct {
	Dialect
	*Args
	ListUsersRequest
}
