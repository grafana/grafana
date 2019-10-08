package plugin

import (
	"fmt"
	"os"
)

// ServeMuxMap is the type that is used to configure ServeMux
type ServeMuxMap map[string]*ServeConfig

// ServeMux is like Serve, but serves multiple types of plugins determined
// by the argument given on the command-line.
//
// This command doesn't return until the plugin is done being executed. Any
// errors are logged or output to stderr.
func ServeMux(m ServeMuxMap) {
	if len(os.Args) != 2 {
		fmt.Fprintf(os.Stderr,
			"Invoked improperly. This is an internal command that shouldn't\n"+
				"be manually invoked.\n")
		os.Exit(1)
	}

	opts, ok := m[os.Args[1]]
	if !ok {
		fmt.Fprintf(os.Stderr, "Unknown plugin: %s\n", os.Args[1])
		os.Exit(1)
	}

	Serve(opts)
}
