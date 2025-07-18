package codegen

import (
	"bytes"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/plugins/codegen/pfs"
)

const generatedSchemas = "packages/grafana-schema/src/**/*%s*"
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
	
	codeownerPath := fmt.Sprintf(generatedSchemas, strings.Split(decl.PluginPath, "/")[1])
	genCodeOwner := lookForCodeOwner(lines, codeownerPath)
	if genCodeOwner != "" {
		return nil, nil
	}
	
	fmt.Println("assigning codeowner for", strings.Split(decl.PluginPath, "/")[1])
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
	fmt.Println(path)
	var pkgStart, pkgEnd = -1, -1
	var packageLines []string
	
	for i, line := range lines {
		if strings.HasPrefix(line, "# Package") {
			pkgStart = i + 1
			for j := pkgStart; j < len(lines); j++ {
				if strings.HasPrefix(lines[j], "#") && j != pkgStart {
					pkgEnd = j
					break
				}
			}
			if pkgEnd == -1 {
				pkgEnd = len(lines)
			}
			packageLines = lines[pkgStart:pkgEnd]
			break
		}
	}
	
	packageLines = append(packageLines, path)
	
	var cleanLines []string
	for _, l := range packageLines {
		if strings.TrimSpace(l) != "" {
			cleanLines = append(cleanLines, l)
		}
	}
	
	sort.Strings(cleanLines)
	
	var newContent bytes.Buffer
	for i := 0; i < pkgStart; i++ {
		newContent.WriteString(lines[i] + "\n")
	}
	for _, l := range cleanLines {
		newContent.WriteString(l + "\n")
	}
	for i := pkgEnd; i < len(lines); i++ {
		newContent.WriteString(lines[i] + "\n")
	}
	
	return os.WriteFile(filepath.Join(jenny.Root, ".github", "CODEOWNERS"), newContent.Bytes(), 0644)
}
