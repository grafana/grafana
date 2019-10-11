package packages

import (
	"fmt"

	"golang.org/x/tools/go/packages"
)

func ExtractErrors(pkg *packages.Package) []packages.Error {
	errors := extractErrorsImpl(pkg, map[*packages.Package]bool{})
	if len(errors) == 0 {
		return errors
	}

	seenErrors := map[string]bool{}
	var uniqErrors []packages.Error
	for _, err := range errors {
		if seenErrors[err.Msg] {
			continue
		}
		seenErrors[err.Msg] = true
		uniqErrors = append(uniqErrors, err)
	}

	if len(pkg.GoFiles) != 0 {
		// errors were extracted from deps and have at leat one file in package
		for i := range uniqErrors {
			_, parseErr := ParseErrorPosition(uniqErrors[i].Pos)
			if parseErr != nil {
				// change pos to local file to properly process it by processors (properly read line etc)
				uniqErrors[i].Msg = fmt.Sprintf("%s: %s", uniqErrors[i].Pos, uniqErrors[i].Msg)
				uniqErrors[i].Pos = fmt.Sprintf("%s:1", pkg.GoFiles[0])
			}
		}

		// some errors like "code in directory  expects import" don't have Pos, set it here
		for i := range uniqErrors {
			err := &uniqErrors[i]
			if err.Pos == "" {
				err.Pos = fmt.Sprintf("%s:1", pkg.GoFiles[0])
			}
		}
	}

	return uniqErrors
}

func extractErrorsImpl(pkg *packages.Package, seenPackages map[*packages.Package]bool) []packages.Error {
	if seenPackages[pkg] {
		return nil
	}
	seenPackages[pkg] = true

	if !pkg.IllTyped { // otherwise it may take hours to traverse all deps many times
		return nil
	}

	if len(pkg.Errors) != 0 {
		return pkg.Errors
	}

	var errors []packages.Error
	for _, iPkg := range pkg.Imports {
		iPkgErrors := extractErrorsImpl(iPkg, seenPackages)
		if iPkgErrors != nil {
			errors = append(errors, iPkgErrors...)
		}
	}

	return errors
}
