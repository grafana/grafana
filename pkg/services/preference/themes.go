//go:generate go run generate_themes.go

package pref

type ThemeDTO struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	IsExtra bool   `json:"isExtra"`
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
