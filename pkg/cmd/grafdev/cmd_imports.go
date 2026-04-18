package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/urfave/cli/v2"
)

func cmdImports() *cli.Command {
	return &cli.Command{
		Name:  "imports",
		Usage: "Help for pkg/extensions/enterprise_imports.go (GE-only Go deps)",
		Subcommands: []*cli.Command{
			{
				Name:  "explain",
				Usage: "Print where enterprise_imports.go lives and the upstream comment guidance",
				Action: func(c *cli.Context) error {
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					path := p.EnterpriseImportsGo()
					_, _ = fmt.Fprintf(c.App.Writer, "File: %s\n\n", path)
					b, err := os.ReadFile(path)
					if err != nil {
						return err
					}
					lines := strings.Split(string(b), "\n")
					for _, ln := range lines {
						if strings.HasPrefix(strings.TrimSpace(ln), "//") {
							_, _ = fmt.Fprintln(c.App.Writer, ln)
							continue
						}
						if strings.HasPrefix(strings.TrimSpace(ln), "package ") {
							break
						}
					}
					_, _ = fmt.Fprintln(c.App.Writer, "\nAdd a blank import for modules used only in enterprise code so they become direct dependencies in go.mod.")
					return nil
				},
			},
			{
				Name:      "add",
				Usage:     "Insert a blank import into enterprise_imports.go (preserves //go:build lines)",
				ArgsUsage: "<import-path>",
				Flags: []cli.Flag{
					&cli.BoolFlag{Name: "yes", Aliases: []string{"y"}, Usage: "Confirm writing the file"},
				},
				Action: func(c *cli.Context) error {
					ip := strings.TrimSpace(strings.Trim(c.Args().First(), `"`))
					if ip == "" {
						return fmt.Errorf("import path required")
					}
					if !c.Bool("yes") {
						return fmt.Errorf("refusing without --yes to modify enterprise_imports.go")
					}
					p, err := mustResolve(c)
					if err != nil {
						return err
					}
					return addEnterpriseImport(p.OSS, ip)
				},
			},
		},
	}
}

func addEnterpriseImport(ossRoot, importPath string) error {
	path := filepath.Join(ossRoot, "pkg", "extensions", "enterprise_imports.go")
	src, err := os.ReadFile(path)
	if err != nil {
		return err
	}
	s := string(src)
	if strings.Contains(s, `"`+importPath+`"`) {
		return fmt.Errorf("import %q already present", importPath)
	}
	var pos int
	switch {
	case strings.Contains(s, "import (\n"):
		needle := "import (\n"
		pos = strings.Index(s, needle) + len(needle)
	case strings.Contains(s, "import (\r\n"):
		needle := "import (\r\n"
		pos = strings.Index(s, needle) + len(needle)
	default:
		return fmt.Errorf("could not find multi-line import block in %s", path)
	}
	line := "\t_ \"" + importPath + "\"\n"
	out := s[:pos] + line + s[pos:]
	st, err := os.Stat(path)
	mode := os.FileMode(0o644)
	if err == nil {
		mode = st.Mode()
	}
	return os.WriteFile(path, []byte(out), mode)
}
