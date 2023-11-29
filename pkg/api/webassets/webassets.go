package webassets

import (
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
)

var logger log.Logger = log.New("webassets")

func LoadWebAssets(staticRootPath string) (*dtos.EntryPointAssets, error) {
	jsonFile, err := os.Open(filepath.Join(staticRootPath, "build", "assets-manifest.json"))
	// if we os.Open returns an error then handle it
	if err != nil {
		return nil, fmt.Errorf("failed to load assets-manifest.json %f", err)
	}

	defer jsonFile.Close()

	bytes, _ := io.ReadAll(jsonFile)
	content, err := simplejson.NewJson(bytes)

	if err != nil {
		return nil, fmt.Errorf("failed to parse assets-manifest.json %f", err)
	}

	entryPoints := content.GetPath("entrypoints", "app", "assets", "js")
	if entryPoints == nil {
		return nil, fmt.Errorf("could not find entrypoints in asssets-manifest")
	}

	entryPointJSAssets := make([]dtos.EntryPointAsset, 0)

	for _, entryPoint := range entryPoints.MustArray() {
		entryPointJSAssets = append(entryPointJSAssets, dtos.EntryPointAsset{
			FilePath: entryPoint.(string),
		})
	}

	darkCss := content.GetPath("entrypoints", "dark", "assets", "css")
	lightCss := content.GetPath("entrypoints", "light", "assets", "css")

	if darkCss == nil || len(darkCss.MustArray()) == 0 {
		return nil, fmt.Errorf("could not find css files in assets-manifest")
	}

	if lightCss == nil || len(lightCss.MustArray()) == 0 {
		return nil, fmt.Errorf("could not find css files in assets-manifest")
	}

	return &dtos.EntryPointAssets{
		JSFiles:  entryPointJSAssets,
		CSSDark:  darkCss.MustArray()[0].(string),
		CSSLight: lightCss.MustArray()[0].(string),
	}, nil
}
