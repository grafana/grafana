package manifest

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

type manifestInfo struct {
	FilePath  string `json:"src,omitempty"`
	Integrity string `json:"integrity,omitempty"`

	App     *entryPointInfo `json:"app,omitempty"`
	Dark    *entryPointInfo `json:"dark,omitempty"`
	Light   *entryPointInfo `json:"light,omitempty"`
	Swagger *entryPointInfo `json:"swagger,omitempty"`
}

type entryPointInfo struct {
	Assets struct {
		JS  []string `json:"js,omitempty"`
		CSS []string `json:"css,omitempty"`
	} `json:"assets,omitempty"`
}

type EntryPointAsset struct {
	FilePath  string
	Integrity string
}

type EntryPointAssets struct {
	JSFiles         []EntryPointAsset
	CSSFiles        []EntryPointAsset
	Dark            string
	Light           string
	Swagger         []EntryPointAsset
	SwaggerCSSFiles []EntryPointAsset
}

func ReadFromFile(manifestPath string) (*EntryPointAssets, error) {
	//nolint:gosec
	f, err := os.Open(manifestPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load assets-manifest.json %w", err)
	}
	defer func() {
		_ = f.Close()
	}()

	return Read(f)
}

func Read(r io.Reader) (*EntryPointAssets, error) {
	manifest := map[string]manifestInfo{}
	if err := json.NewDecoder(r).Decode(&manifest); err != nil {
		return nil, fmt.Errorf("failed to read assets-manifest.json %w", err)
	}

	integrity := make(map[string]string, 100)
	for _, v := range manifest {
		if v.Integrity != "" && v.FilePath != "" {
			integrity[v.FilePath] = v.Integrity
		}
	}

	entryPoints, ok := manifest["entrypoints"]
	if !ok {
		return nil, fmt.Errorf("could not find entrypoints in asssets-manifest")
	}

	if entryPoints.App == nil || len(entryPoints.App.Assets.JS) == 0 {
		return nil, fmt.Errorf("missing app entry, try running `yarn build`")
	}
	if entryPoints.Dark == nil || len(entryPoints.Dark.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing dark entry, try running `yarn build`")
	}
	if entryPoints.Light == nil || len(entryPoints.Light.Assets.CSS) == 0 {
		return nil, fmt.Errorf("missing light entry, try running `yarn build`")
	}
	if entryPoints.Swagger == nil || len(entryPoints.Swagger.Assets.JS) == 0 {
		return nil, fmt.Errorf("missing swagger entry, try running `yarn build`")
	}

	rsp := &EntryPointAssets{
		JSFiles:         make([]EntryPointAsset, 0, len(entryPoints.App.Assets.JS)),
		CSSFiles:        make([]EntryPointAsset, 0, len(entryPoints.App.Assets.CSS)),
		Dark:            entryPoints.Dark.Assets.CSS[0],
		Light:           entryPoints.Light.Assets.CSS[0],
		Swagger:         make([]EntryPointAsset, 0, len(entryPoints.Swagger.Assets.JS)),
		SwaggerCSSFiles: make([]EntryPointAsset, 0, len(entryPoints.Swagger.Assets.CSS)),
	}

	for _, entry := range entryPoints.App.Assets.JS {
		rsp.JSFiles = append(rsp.JSFiles, EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.App.Assets.CSS {
		rsp.CSSFiles = append(rsp.CSSFiles, EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.Swagger.Assets.JS {
		rsp.Swagger = append(rsp.Swagger, EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}
	for _, entry := range entryPoints.Swagger.Assets.CSS {
		rsp.SwaggerCSSFiles = append(rsp.SwaggerCSSFiles, EntryPointAsset{
			FilePath:  entry,
			Integrity: integrity[entry],
		})
	}

	return rsp, nil
}
