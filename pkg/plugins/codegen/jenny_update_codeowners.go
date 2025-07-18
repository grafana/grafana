package codegen

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/codegen/pfs"
)

const generatedSchemas = "packages/grafana-schema/src/**/%s"
const ownerRegex = `^\/(.+?) ((?:@\S+\s*)+)$`

type UpdateCodeOwners struct {
	Root         string
	PanelsFolder string
}

func (jenny *UpdateCodeOwners) JennyName() string {
	return "UpdateCodeOwners"
}

func (jenny *UpdateCodeOwners) Generate(decl *pfs.PluginDecl) (codejen.Files, error) {
	codeowners, err := os.ReadFile(filepath.Join(jenny.Root, ".github", "CODEOWNERS"))
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(codeowners), "\n")

	codeOwner := lookForCodeOwner(lines, filepath.Join(jenny.PanelsFolder, decl.PluginPath))
	if codeOwner == "" {
		fmt.Printf("we couldn't find a code owner for %s plugin\n", filepath.Join(jenny.PanelsFolder, decl.PluginPath))
		return nil, nil
	}

	pathName := strings.ReplaceAll(strings.ToLower(decl.PluginMeta.Name), " ", "")
	codeownerPath := fmt.Sprintf(generatedSchemas, pathName)
	genCodeOwner := lookForCodeOwner(lines, codeownerPath)
	if genCodeOwner != "" {
		return nil, nil
	}

	fmt.Println("assigning codeowner for", pathName)
	return nil, jenny.insertCodeOwner(lines, fmt.Sprintf("/%s %s", codeownerPath, codeOwner))
}

func lookForCodeOwner(lines []string, path string) string {
	codeOwner := ""
	for _, line := range lines {
		reg := regexp.MustCompile(ownerRegex)
		parts := reg.FindStringSubmatch(line)
		if len(parts) != 3 {
			continue
		}

		if strings.Trim(parts[1], "/") == path {
			codeOwner = parts[2]
			break
		}
	}

	return codeOwner
}

func (jenny *UpdateCodeOwners) insertCodeOwner(lines []string, path string) error {
	var pkgStart, pkgEnd = -1, -1
	for i, line := range lines {
		if strings.HasPrefix(strings.ToLower(line), "# packages") {
			pkgStart = i
			for j := pkgStart + 1; j < len(lines); j++ {
				if strings.HasPrefix(lines[j], "#") {
					pkgEnd = j
					break
				}
			}
			if pkgEnd == -1 {
				pkgEnd = len(lines)
			}
			break
		}
	}

	if pkgStart == -1 {
		return nil
	}

	packageLines := lines[pkgStart+1 : pkgEnd-1]
	packageLines = append(packageLines, path)
	sort.Strings(packageLines)

	var output []string
	output = append(output, lines[:pkgStart+1]...)
	output = append(output, packageLines...)
	if pkgEnd < len(lines) && (len(output) == 0 || output[len(output)-1] != "") {
		output = append(output, "")
	}

	output = append(output, lines[pkgEnd:]...)
	return os.WriteFile(filepath.Join(jenny.Root, ".github", "CODEOWNERS"), []byte(strings.Join(output, "\n")), 0644)
}
