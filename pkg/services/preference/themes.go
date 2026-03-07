//go:generate go run generate_themes.go

package pref

import "context"

type ThemeDTO struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	IsExtra bool   `json:"isExtra"`
}

// ThemeValidator validates theme IDs and retrieves theme metadata.
// It checks both built-in themes and custom themes from the theme app.
type ThemeValidator interface {
	// IsValidThemeID returns true if the given theme ID corresponds to
	// a built-in theme or a custom theme in the given org's namespace.
	IsValidThemeID(ctx context.Context, orgID int64, id string) bool

	// GetThemeByID returns the ThemeDTO for the given theme ID, checking
	// built-in themes first, then custom themes in the given org's namespace.
	// Returns nil if not found.
	GetThemeByID(ctx context.Context, orgID int64, id string) *ThemeDTO
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
