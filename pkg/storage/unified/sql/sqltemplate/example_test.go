package sqltemplate

import (
	"fmt"
	"regexp"
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
//
// If you're unfamiliar with Go text templating language, please, consider
// reading that library's documentation first.

// In this example we will use both Args and Dialect to dynamically and securely
// build SQL queries, while also keeping track of the arguments that need to be
// passed to the database methods to replace the placeholder "?" with the
// correct values.

// We will start by assuming we receive a request to retrieve a user's
// information and that we need to provide a certain response.

type GetUserRequest struct {
	ID int
}

type GetUserResponse struct {
	ID   int
	Type string
	Name string
}

// Our template will take care for us of taking the request to build the query,
// and then sort the arguments for execution as well as preparing the values
// that need to be read for the response. We wil create a struct to pass the
// request and an empty response, as well as a *SQLTemplate that will provide
// the methods to achieve our purpose::

type GetUserQuery struct {
	*SQLTemplate
	Request  *GetUserRequest
	Response *GetUserResponse
}

// And finally we will define our template, that is free to use all the power of
// the Go templating language, plus the methods we added with *SQLTemplate:
var getUserTmpl = template.Must(template.New("example").Parse(`
	SELECT
			{{ .Ident "id"   | .Into .Response.ID }},
			{{ .Ident "type" | .Into .Response.Type }},
			{{ .Ident "name" | .Into .Response.Name }}

		FROM {{ .Ident "users" }}
		WHERE
			{{ .Ident "id" }} = {{ .Arg .Request.ID }};
`))

// There are three interesting methods used in the above template:
//	1. Ident: safely escape a SQL identifier. Even though here the only
//	   identifier that may be problematic is "type" (because it is a reserved
//	   word in many dialects), it is a good practice to escape all identifiers
//	   just to make sure we're accounting for all variability in dialects, and
//	   also for consistency.
//	2. Into: this causes the selected field to be saved to the corresponding
//	   field of GetUserQuery.
//	3. Arg: this allows us to state that at this point will be a "?" that has to
//	   be populated with the value of the given field of GetUserQuery.

func Example() {
	// Let's pretend this example function is the handler of the GetUser method
	// of our service to see how it all works together.

	queryData := &GetUserQuery{
		// The dialect (in this case we chose MySQL) should be set in your
		// service at startup when you connect to your database
		SQLTemplate: New(MySQL),

		// This is a synthetic request for our test
		Request: &GetUserRequest{
			ID: 1,
		},

		// Create an empty response to be populated
		Response: new(GetUserResponse),
	}

	// The next step is to execute the query template for our queryData, and
	// generate the arguments for the db.QueryRow and row.Scan methods later
	query, err := Execute(getUserTmpl, queryData)
	if err != nil {
		panic(err) // terminate the runnable example on error
	}

	// Assuming that we have a *sql.DB object named "db", we could now make our
	// query with:
	//	row := db.QueryRowContext(ctx, query, queryData.GetArgs()...)
	//	// and check row.Err() here

	// As we're not actually running a database in this example, let's verify
	// that we find our arguments populated as expected instead:
	if len(queryData.GetArgs()) != 1 {
		panic(fmt.Sprintf("unexpected number of args: %#v", queryData.Args))
	}
	id, ok := queryData.GetArgs()[0].(int)
	if !ok || id != queryData.Request.ID {
		panic(fmt.Sprintf("unexpected args: %#v", queryData.Args))
	}

	// In your code you would now have "row" populated with the row data,
	// assuming that the operation succeeded, so you would now scan the row data
	// abd populate the values of our response:
	//	err := row.Scan(queryData.GetScanDest()...)
	//	// and check err here

	// Again, as we're not actually running a database in this example, we will
	// instead run the code to assert that queryData.ScanDest was populated with
	// the expected data, which should be pointers to each of the fields of
	// Response so that the Scan method can write to them:
	if len(queryData.GetScanDest()) != 3 {
		panic(fmt.Sprintf("unexpected number of scan dest: %#v", queryData.ScanDest))
	}
	idPtr, ok := queryData.GetScanDest()[0].(*int)
	if !ok || idPtr != &queryData.Response.ID {
		panic(fmt.Sprintf("unexpected response 'id' pointer: %#v", queryData.ScanDest))
	}
	typePtr, ok := queryData.GetScanDest()[1].(*string)
	if !ok || typePtr != &queryData.Response.Type {
		panic(fmt.Sprintf("unexpected response 'type' pointer: %#v", queryData.ScanDest))
	}
	namePtr, ok := queryData.GetScanDest()[2].(*string)
	if !ok || namePtr != &queryData.Response.Name {
		panic(fmt.Sprintf("unexpected response 'name' pointer: %#v", queryData.ScanDest))
	}

	// Remember the variable "query"? Well, we didn't check it. We will now make
	// use of Go's runnable examples and print its contents to standard output
	// so Go's tooling verify this example's output each time we run tests.
	// By the way, to make the result more stable, we will remove some
	// unnecessary white space from the query.
	whiteSpaceRE := regexp.MustCompile(`\s+`)
	query = strings.TrimSpace(whiteSpaceRE.ReplaceAllString(query, " "))
	fmt.Println(query)

	// Output:
	// SELECT "id", "type", "name" FROM "users" WHERE "id" = ?;
}
