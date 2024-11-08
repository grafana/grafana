package pref

type ThemeDTO struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	IsExtra bool   `json:"isExtra"`
}

var themes = []ThemeDTO{
	{ID: "light", Type: "light"},
	{ID: "dark", Type: "dark"},
	{ID: "system", Type: "dark"},
	{ID: "debug", Type: "dark", IsExtra: true},
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
