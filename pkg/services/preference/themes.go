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
	{ID: "aubergine", Type: "dark", IsExtra: true},
	{ID: "desertbloom", Type: "light", IsExtra: true},
	{ID: "gildedgrove", Type: "dark", IsExtra: true},
	{ID: "mars", Type: "dark", IsExtra: true},
	{ID: "matrix", Type: "dark", IsExtra: true},
	{ID: "sapphiredusk", Type: "dark", IsExtra: true},
	{ID: "synthwave", Type: "dark", IsExtra: true},
	{ID: "tron", Type: "dark", IsExtra: true},
	{ID: "victorian", Type: "dark", IsExtra: true},
	{ID: "zen", Type: "light", IsExtra: true},
	{ID: "gloom", Type: "dark", IsExtra: true},
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
