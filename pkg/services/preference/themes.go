package pref

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
)

type ThemeDTO struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	IsExtra bool   `json:"isExtra"`
}

type Colors struct {
	Mode string `json:"mode"`
}

type ThemeDefinition struct {
	Colors Colors `json:"colors"`
}

func getExtraThemes(homePath string) []ThemeDTO {
	themesPath := filepath.Join(homePath, "packages/grafana-data/src/themes/themeDefinitions")
	extraThemes := []ThemeDTO{}

	err := filepath.WalkDir(themesPath, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}

		// Only process json files
		if d.IsDir() || !strings.HasSuffix(d.Name(), ".json") {
			return nil
		}

		fileBytes, _ := os.ReadFile(path)
		var themeDef ThemeDefinition
		jsonErr := json.Unmarshal(fileBytes, &themeDef)

		if jsonErr != nil {
			return jsonErr
		}

		themeType := "dark" // default fallback
		if themeDef.Colors.Mode != "" {
			themeType = themeDef.Colors.Mode
		}

		themeId := strings.TrimSuffix(d.Name(), ".json")

		extraThemes = append(extraThemes, ThemeDTO{
			ID:      themeId,
			Type:    themeType,
			IsExtra: true,
		})
		return nil
	})

	if err != nil {
		logger.Error("Error while getting extra themes", "error", err)
		return []ThemeDTO{}
	}

	return extraThemes
}

func InitExtraThemes(homePath string) {
	themes = append(themes, getExtraThemes(homePath)...)
}

var themes = []ThemeDTO{
	{ID: "light", Type: "light"},
	{ID: "dark", Type: "dark"},
	{ID: "system", Type: "dark"},
}

func GetThemeByID(id string) *ThemeDTO {
	for _, theme := range themes {
		if theme.ID == id {
			return &theme
		}
	}

	return nil
}

func IsValidThemeID(id string) bool {
	for _, theme := range themes {
		if theme.ID == id {
			return true
		}
	}
	return false
}
