// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type UserThemeColorSection struct {
	Name              *string         `json:"name,omitempty"`
	Main              *UserThemeColor `json:"main,omitempty"`
	Shade             *UserThemeColor `json:"shade,omitempty"`
	Text              *UserThemeColor `json:"text,omitempty"`
	Border            *UserThemeColor `json:"border,omitempty"`
	Transparent       *UserThemeColor `json:"transparent,omitempty"`
	BorderTransparent *UserThemeColor `json:"borderTransparent,omitempty"`
	ContrastText      *UserThemeColor `json:"contrastText,omitempty"`
}

// NewUserThemeColorSection creates a new UserThemeColorSection object.
func NewUserThemeColorSection() *UserThemeColorSection {
	return &UserThemeColorSection{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeColorSection.
func (UserThemeColorSection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeColorSection"
}

// +k8s:openapi-gen=true
type UserThemeColor string

// +k8s:openapi-gen=true
type UserThemeVisualization struct {
	Hues    []UserThemeHue `json:"hues,omitempty"`
	Palette []string       `json:"palette,omitempty"`
}

// NewUserThemeVisualization creates a new UserThemeVisualization object.
func NewUserThemeVisualization() *UserThemeVisualization {
	return &UserThemeVisualization{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeVisualization.
func (UserThemeVisualization) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeVisualization"
}

// +k8s:openapi-gen=true
type UserThemeHue = UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue

// NewUserThemeHue creates a new UserThemeHue object.
func NewUserThemeHue() *UserThemeHue {
	return NewUserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue()
}

// +k8s:openapi-gen=true
type UserThemeRedHue struct {
	Name   string                          `json:"name"`
	Shades []UserThemeV0alpha1RedHueShades `json:"shades"`
}

// NewUserThemeRedHue creates a new UserThemeRedHue object.
func NewUserThemeRedHue() *UserThemeRedHue {
	return &UserThemeRedHue{
		Name:   "red",
		Shades: []UserThemeV0alpha1RedHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeRedHue.
func (UserThemeRedHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeRedHue"
}

// +k8s:openapi-gen=true
type UserThemeOrangeHue struct {
	Name   string                             `json:"name"`
	Shades []UserThemeV0alpha1OrangeHueShades `json:"shades"`
}

// NewUserThemeOrangeHue creates a new UserThemeOrangeHue object.
func NewUserThemeOrangeHue() *UserThemeOrangeHue {
	return &UserThemeOrangeHue{
		Name:   "orange",
		Shades: []UserThemeV0alpha1OrangeHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeOrangeHue.
func (UserThemeOrangeHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeOrangeHue"
}

// +k8s:openapi-gen=true
type UserThemeYellowHue struct {
	Name   string                             `json:"name"`
	Shades []UserThemeV0alpha1YellowHueShades `json:"shades"`
}

// NewUserThemeYellowHue creates a new UserThemeYellowHue object.
func NewUserThemeYellowHue() *UserThemeYellowHue {
	return &UserThemeYellowHue{
		Name:   "yellow",
		Shades: []UserThemeV0alpha1YellowHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeYellowHue.
func (UserThemeYellowHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeYellowHue"
}

// +k8s:openapi-gen=true
type UserThemeGreenHue struct {
	Name   string                            `json:"name"`
	Shades []UserThemeV0alpha1GreenHueShades `json:"shades"`
}

// NewUserThemeGreenHue creates a new UserThemeGreenHue object.
func NewUserThemeGreenHue() *UserThemeGreenHue {
	return &UserThemeGreenHue{
		Name:   "green",
		Shades: []UserThemeV0alpha1GreenHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeGreenHue.
func (UserThemeGreenHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeGreenHue"
}

// +k8s:openapi-gen=true
type UserThemeBlueHue struct {
	Name   string                           `json:"name"`
	Shades []UserThemeV0alpha1BlueHueShades `json:"shades"`
}

// NewUserThemeBlueHue creates a new UserThemeBlueHue object.
func NewUserThemeBlueHue() *UserThemeBlueHue {
	return &UserThemeBlueHue{
		Name:   "blue",
		Shades: []UserThemeV0alpha1BlueHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeBlueHue.
func (UserThemeBlueHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeBlueHue"
}

// +k8s:openapi-gen=true
type UserThemePurpleHue struct {
	Name   string                             `json:"name"`
	Shades []UserThemeV0alpha1PurpleHueShades `json:"shades"`
}

// NewUserThemePurpleHue creates a new UserThemePurpleHue object.
func NewUserThemePurpleHue() *UserThemePurpleHue {
	return &UserThemePurpleHue{
		Name:   "purple",
		Shades: []UserThemeV0alpha1PurpleHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemePurpleHue.
func (UserThemePurpleHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemePurpleHue"
}

// +k8s:openapi-gen=true
type UserThemeSpec struct {
	UserID        string                           `json:"userID"`
	Name          string                           `json:"name"`
	Colors        *UserThemeV0alpha1SpecColors     `json:"colors,omitempty"`
	Spacing       *UserThemeV0alpha1SpecSpacing    `json:"spacing,omitempty"`
	Shape         *UserThemeV0alpha1SpecShape      `json:"shape,omitempty"`
	Typography    *UserThemeV0alpha1SpecTypography `json:"typography,omitempty"`
	Visualization *UserThemeVisualization          `json:"visualization,omitempty"`
}

// NewUserThemeSpec creates a new UserThemeSpec object.
func NewUserThemeSpec() *UserThemeSpec {
	return &UserThemeSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeSpec.
func (UserThemeSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeSpec"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1RedHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1RedHueShades creates a new UserThemeV0alpha1RedHueShades object.
func NewUserThemeV0alpha1RedHueShades() *UserThemeV0alpha1RedHueShades {
	return &UserThemeV0alpha1RedHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1RedHueShades.
func (UserThemeV0alpha1RedHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1RedHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1OrangeHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1OrangeHueShades creates a new UserThemeV0alpha1OrangeHueShades object.
func NewUserThemeV0alpha1OrangeHueShades() *UserThemeV0alpha1OrangeHueShades {
	return &UserThemeV0alpha1OrangeHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1OrangeHueShades.
func (UserThemeV0alpha1OrangeHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1OrangeHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1YellowHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1YellowHueShades creates a new UserThemeV0alpha1YellowHueShades object.
func NewUserThemeV0alpha1YellowHueShades() *UserThemeV0alpha1YellowHueShades {
	return &UserThemeV0alpha1YellowHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1YellowHueShades.
func (UserThemeV0alpha1YellowHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1YellowHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1GreenHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1GreenHueShades creates a new UserThemeV0alpha1GreenHueShades object.
func NewUserThemeV0alpha1GreenHueShades() *UserThemeV0alpha1GreenHueShades {
	return &UserThemeV0alpha1GreenHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1GreenHueShades.
func (UserThemeV0alpha1GreenHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1GreenHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1BlueHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1BlueHueShades creates a new UserThemeV0alpha1BlueHueShades object.
func NewUserThemeV0alpha1BlueHueShades() *UserThemeV0alpha1BlueHueShades {
	return &UserThemeV0alpha1BlueHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1BlueHueShades.
func (UserThemeV0alpha1BlueHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1BlueHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1PurpleHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewUserThemeV0alpha1PurpleHueShades creates a new UserThemeV0alpha1PurpleHueShades object.
func NewUserThemeV0alpha1PurpleHueShades() *UserThemeV0alpha1PurpleHueShades {
	return &UserThemeV0alpha1PurpleHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1PurpleHueShades.
func (UserThemeV0alpha1PurpleHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1PurpleHueShades"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsText struct {
	Primary     *string `json:"primary,omitempty"`
	Secondary   *string `json:"secondary,omitempty"`
	Disabled    *string `json:"disabled,omitempty"`
	Link        *string `json:"link,omitempty"`
	MaxContrast *string `json:"maxContrast,omitempty"`
}

// NewUserThemeV0alpha1SpecColorsText creates a new UserThemeV0alpha1SpecColorsText object.
func NewUserThemeV0alpha1SpecColorsText() *UserThemeV0alpha1SpecColorsText {
	return &UserThemeV0alpha1SpecColorsText{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsText.
func (UserThemeV0alpha1SpecColorsText) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsText"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsBackground struct {
	Canvas    *string `json:"canvas,omitempty"`
	Primary   *string `json:"primary,omitempty"`
	Secondary *string `json:"secondary,omitempty"`
	Elevated  *string `json:"elevated,omitempty"`
}

// NewUserThemeV0alpha1SpecColorsBackground creates a new UserThemeV0alpha1SpecColorsBackground object.
func NewUserThemeV0alpha1SpecColorsBackground() *UserThemeV0alpha1SpecColorsBackground {
	return &UserThemeV0alpha1SpecColorsBackground{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsBackground.
func (UserThemeV0alpha1SpecColorsBackground) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsBackground"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsBorder struct {
	Weak   *string `json:"weak,omitempty"`
	Medium *string `json:"medium,omitempty"`
	Strong *string `json:"strong,omitempty"`
}

// NewUserThemeV0alpha1SpecColorsBorder creates a new UserThemeV0alpha1SpecColorsBorder object.
func NewUserThemeV0alpha1SpecColorsBorder() *UserThemeV0alpha1SpecColorsBorder {
	return &UserThemeV0alpha1SpecColorsBorder{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsBorder.
func (UserThemeV0alpha1SpecColorsBorder) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsBorder"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsGradients struct {
	BrandVertical   *string `json:"brandVertical,omitempty"`
	BrandHorizontal *string `json:"brandHorizontal,omitempty"`
}

// NewUserThemeV0alpha1SpecColorsGradients creates a new UserThemeV0alpha1SpecColorsGradients object.
func NewUserThemeV0alpha1SpecColorsGradients() *UserThemeV0alpha1SpecColorsGradients {
	return &UserThemeV0alpha1SpecColorsGradients{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsGradients.
func (UserThemeV0alpha1SpecColorsGradients) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsGradients"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsAction struct {
	Selected           *string  `json:"selected,omitempty"`
	SelectedBorder     *string  `json:"selectedBorder,omitempty"`
	Hover              *string  `json:"hover,omitempty"`
	HoverOpacity       *float64 `json:"hoverOpacity,omitempty"`
	Focus              *string  `json:"focus,omitempty"`
	DisabledBackground *string  `json:"disabledBackground,omitempty"`
	DisabledText       *string  `json:"disabledText,omitempty"`
	DisabledOpacity    *float64 `json:"disabledOpacity,omitempty"`
}

// NewUserThemeV0alpha1SpecColorsAction creates a new UserThemeV0alpha1SpecColorsAction object.
func NewUserThemeV0alpha1SpecColorsAction() *UserThemeV0alpha1SpecColorsAction {
	return &UserThemeV0alpha1SpecColorsAction{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsAction.
func (UserThemeV0alpha1SpecColorsAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsAction"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColors struct {
	Mode              *UserThemeV0alpha1SpecColorsMode       `json:"mode,omitempty"`
	Primary           *UserThemeColorSection                 `json:"primary,omitempty"`
	Secondary         *UserThemeColorSection                 `json:"secondary,omitempty"`
	Info              *UserThemeColorSection                 `json:"info,omitempty"`
	Error             *UserThemeColorSection                 `json:"error,omitempty"`
	Success           *UserThemeColorSection                 `json:"success,omitempty"`
	Warning           *UserThemeColorSection                 `json:"warning,omitempty"`
	Text              *UserThemeV0alpha1SpecColorsText       `json:"text,omitempty"`
	Background        *UserThemeV0alpha1SpecColorsBackground `json:"background,omitempty"`
	Border            *UserThemeV0alpha1SpecColorsBorder     `json:"border,omitempty"`
	Gradients         *UserThemeV0alpha1SpecColorsGradients  `json:"gradients,omitempty"`
	Action            *UserThemeV0alpha1SpecColorsAction     `json:"action,omitempty"`
	Scrollbar         *string                                `json:"scrollbar,omitempty"`
	HoverFactor       *float64                               `json:"hoverFactor,omitempty"`
	ContrastThreshold *float64                               `json:"contrastThreshold,omitempty"`
	TonalOffset       *float64                               `json:"tonalOffset,omitempty"`
}

// NewUserThemeV0alpha1SpecColors creates a new UserThemeV0alpha1SpecColors object.
func NewUserThemeV0alpha1SpecColors() *UserThemeV0alpha1SpecColors {
	return &UserThemeV0alpha1SpecColors{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColors.
func (UserThemeV0alpha1SpecColors) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColors"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecSpacing struct {
	GridSize *int64 `json:"gridSize,omitempty"`
}

// NewUserThemeV0alpha1SpecSpacing creates a new UserThemeV0alpha1SpecSpacing object.
func NewUserThemeV0alpha1SpecSpacing() *UserThemeV0alpha1SpecSpacing {
	return &UserThemeV0alpha1SpecSpacing{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecSpacing.
func (UserThemeV0alpha1SpecSpacing) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecSpacing"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecShape struct {
	BorderRadius *int64 `json:"borderRadius,omitempty"`
}

// NewUserThemeV0alpha1SpecShape creates a new UserThemeV0alpha1SpecShape object.
func NewUserThemeV0alpha1SpecShape() *UserThemeV0alpha1SpecShape {
	return &UserThemeV0alpha1SpecShape{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecShape.
func (UserThemeV0alpha1SpecShape) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecShape"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecTypography struct {
	FontFamily          *string  `json:"fontFamily,omitempty"`
	FontFamilyMonospace *string  `json:"fontFamilyMonospace,omitempty"`
	FontSize            *float64 `json:"fontSize,omitempty"`
	FontWeightLight     *float64 `json:"fontWeightLight,omitempty"`
	FontWeightRegular   *float64 `json:"fontWeightRegular,omitempty"`
	FontWeightMedium    *float64 `json:"fontWeightMedium,omitempty"`
	FontWeightBold      *float64 `json:"fontWeightBold,omitempty"`
	HtmlFontSize        *float64 `json:"htmlFontSize,omitempty"`
}

// NewUserThemeV0alpha1SpecTypography creates a new UserThemeV0alpha1SpecTypography object.
func NewUserThemeV0alpha1SpecTypography() *UserThemeV0alpha1SpecTypography {
	return &UserThemeV0alpha1SpecTypography{}
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecTypography.
func (UserThemeV0alpha1SpecTypography) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecTypography"
}

// +k8s:openapi-gen=true
type UserThemeV0alpha1SpecColorsMode string

const (
	UserThemeV0alpha1SpecColorsModeLight UserThemeV0alpha1SpecColorsMode = "light"
	UserThemeV0alpha1SpecColorsModeDark  UserThemeV0alpha1SpecColorsMode = "dark"
)

// OpenAPIModelName returns the OpenAPI model name for UserThemeV0alpha1SpecColorsMode.
func (UserThemeV0alpha1SpecColorsMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeV0alpha1SpecColorsMode"
}

// +k8s:openapi-gen=true
type UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue struct {
	RedHue    *UserThemeRedHue    `json:"RedHue,omitempty"`
	OrangeHue *UserThemeOrangeHue `json:"OrangeHue,omitempty"`
	YellowHue *UserThemeYellowHue `json:"YellowHue,omitempty"`
	GreenHue  *UserThemeGreenHue  `json:"GreenHue,omitempty"`
	BlueHue   *UserThemeBlueHue   `json:"BlueHue,omitempty"`
	PurpleHue *UserThemePurpleHue `json:"PurpleHue,omitempty"`
}

// NewUserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue creates a new UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue object.
func NewUserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue() *UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue {
	return &UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue` as JSON.
func (resource UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) MarshalJSON() ([]byte, error) {
	if resource.RedHue != nil {
		return json.Marshal(resource.RedHue)
	}
	if resource.OrangeHue != nil {
		return json.Marshal(resource.OrangeHue)
	}
	if resource.YellowHue != nil {
		return json.Marshal(resource.YellowHue)
	}
	if resource.GreenHue != nil {
		return json.Marshal(resource.GreenHue)
	}
	if resource.BlueHue != nil {
		return json.Marshal(resource.BlueHue)
	}
	if resource.PurpleHue != nil {
		return json.Marshal(resource.PurpleHue)
	}

	return []byte("null"), nil
}

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue` from JSON.
func (resource *UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) UnmarshalJSON(raw []byte) error {
	if raw == nil {
		return nil
	}

	// FIXME: this is wasteful, we need to find a more efficient way to unmarshal this.
	parsedAsMap := make(map[string]interface{})
	if err := json.Unmarshal(raw, &parsedAsMap); err != nil {
		return err
	}

	discriminator, found := parsedAsMap["name"]
	if !found {
		return nil
	}

	switch discriminator {
	case "blue":
		var userThemeBlueHue UserThemeBlueHue
		if err := json.Unmarshal(raw, &userThemeBlueHue); err != nil {
			return err
		}

		resource.BlueHue = &userThemeBlueHue
		return nil
	case "green":
		var userThemeGreenHue UserThemeGreenHue
		if err := json.Unmarshal(raw, &userThemeGreenHue); err != nil {
			return err
		}

		resource.GreenHue = &userThemeGreenHue
		return nil
	case "orange":
		var userThemeOrangeHue UserThemeOrangeHue
		if err := json.Unmarshal(raw, &userThemeOrangeHue); err != nil {
			return err
		}

		resource.OrangeHue = &userThemeOrangeHue
		return nil
	case "purple":
		var userThemePurpleHue UserThemePurpleHue
		if err := json.Unmarshal(raw, &userThemePurpleHue); err != nil {
			return err
		}

		resource.PurpleHue = &userThemePurpleHue
		return nil
	case "red":
		var userThemeRedHue UserThemeRedHue
		if err := json.Unmarshal(raw, &userThemeRedHue); err != nil {
			return err
		}

		resource.RedHue = &userThemeRedHue
		return nil
	case "yellow":
		var userThemeYellowHue UserThemeYellowHue
		if err := json.Unmarshal(raw, &userThemeYellowHue); err != nil {
			return err
		}

		resource.YellowHue = &userThemeYellowHue
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue.
func (UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.UserThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue"
}
