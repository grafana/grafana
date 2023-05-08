package pref

type ThemeDTO struct {
	Name string `json:"name"`
	ID   string `json:"id"`
	Type string `json:"type"`
}

var themes = []ThemeDTO{
	{Name: "Light", ID: "light", Type: "light"},
	{Name: "Dark", ID: "dark", Type: "dark"},
	{Name: "System", ID: "system", Type: "dark"},
	{Name: "Midnight", ID: "midnight", Type: "dark"},
	{Name: "Blue night", ID: "blue-night", Type: "dark"},
}

func GetThemes() []ThemeDTO {
	return themes
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
	return GetThemeByID(id) != nil
}
