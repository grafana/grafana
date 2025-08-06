//go:build ruleguard

package gorules

import "github.com/quasilyte/go-ruleguard/dsl"

//doc:summary *cli.Context instances should have the variable name `c` or `cliCtx`
func correctNameForCLIContext(m dsl.Matcher) {
	m.Import("github.com/urfave/cli/v2")
	m.Match(
		`func $_($varname $vartype) error { $*_ }`,
		`func ($_ $_) $_($varname $vartype) error { $*_ }`,
	).
		Where(m["vartype"].Type.Is("*v2.Context") && (m["varname"].Text != "c" && m["varname"].Text != "cliCtx")).
		Report("*cli.Context arguments should have the name c or cliCtx but was $varname")
}
