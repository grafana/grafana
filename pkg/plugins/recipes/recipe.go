package recipes

type RecipeMeta struct {
	Summary     string `json:"summary"`
	Description string `json:"description"`
}

type Recipe struct {
	Id    string       `json:"id"`
	Name  string       `json:"name"`
	Meta  RecipeMeta   `json:"meta"`
	Steps []RecipeStep `json:"steps"`
}
