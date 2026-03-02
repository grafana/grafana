// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

import (
	json "encoding/json"
)

// +k8s:openapi-gen=true
type ThemeColorSection struct {
	Name              *string     `json:"name,omitempty"`
	Main              *ThemeColor `json:"main,omitempty"`
	Shade             *ThemeColor `json:"shade,omitempty"`
	Text              *ThemeColor `json:"text,omitempty"`
	Border            *ThemeColor `json:"border,omitempty"`
	Transparent       *ThemeColor `json:"transparent,omitempty"`
	BorderTransparent *ThemeColor `json:"borderTransparent,omitempty"`
	ContrastText      *ThemeColor `json:"contrastText,omitempty"`
}

// NewThemeColorSection creates a new ThemeColorSection object.
func NewThemeColorSection() *ThemeColorSection {
	return &ThemeColorSection{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeColorSection.
func (ThemeColorSection) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeColorSection"
}

// +k8s:openapi-gen=true
type ThemeColor string

// +k8s:openapi-gen=true
type ThemeVisualization struct {
	Hues    []ThemeHue `json:"hues,omitempty"`
	Palette []string   `json:"palette,omitempty"`
}

// NewThemeVisualization creates a new ThemeVisualization object.
func NewThemeVisualization() *ThemeVisualization {
	return &ThemeVisualization{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeVisualization.
func (ThemeVisualization) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeVisualization"
}

// +k8s:openapi-gen=true
type ThemeHue = ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue

// NewThemeHue creates a new ThemeHue object.
func NewThemeHue() *ThemeHue {
	return NewThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue()
}

// +k8s:openapi-gen=true
type ThemeRedHue struct {
	Name   string                      `json:"name"`
	Shades []ThemeV0alpha1RedHueShades `json:"shades"`
}

// NewThemeRedHue creates a new ThemeRedHue object.
func NewThemeRedHue() *ThemeRedHue {
	return &ThemeRedHue{
		Name:   "red",
		Shades: []ThemeV0alpha1RedHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeRedHue.
func (ThemeRedHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeRedHue"
}

// +k8s:openapi-gen=true
type ThemeOrangeHue struct {
	Name   string                         `json:"name"`
	Shades []ThemeV0alpha1OrangeHueShades `json:"shades"`
}

// NewThemeOrangeHue creates a new ThemeOrangeHue object.
func NewThemeOrangeHue() *ThemeOrangeHue {
	return &ThemeOrangeHue{
		Name:   "orange",
		Shades: []ThemeV0alpha1OrangeHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeOrangeHue.
func (ThemeOrangeHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeOrangeHue"
}

// +k8s:openapi-gen=true
type ThemeYellowHue struct {
	Name   string                         `json:"name"`
	Shades []ThemeV0alpha1YellowHueShades `json:"shades"`
}

// NewThemeYellowHue creates a new ThemeYellowHue object.
func NewThemeYellowHue() *ThemeYellowHue {
	return &ThemeYellowHue{
		Name:   "yellow",
		Shades: []ThemeV0alpha1YellowHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeYellowHue.
func (ThemeYellowHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeYellowHue"
}

// +k8s:openapi-gen=true
type ThemeGreenHue struct {
	Name   string                        `json:"name"`
	Shades []ThemeV0alpha1GreenHueShades `json:"shades"`
}

// NewThemeGreenHue creates a new ThemeGreenHue object.
func NewThemeGreenHue() *ThemeGreenHue {
	return &ThemeGreenHue{
		Name:   "green",
		Shades: []ThemeV0alpha1GreenHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeGreenHue.
func (ThemeGreenHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeGreenHue"
}

// +k8s:openapi-gen=true
type ThemeBlueHue struct {
	Name   string                       `json:"name"`
	Shades []ThemeV0alpha1BlueHueShades `json:"shades"`
}

// NewThemeBlueHue creates a new ThemeBlueHue object.
func NewThemeBlueHue() *ThemeBlueHue {
	return &ThemeBlueHue{
		Name:   "blue",
		Shades: []ThemeV0alpha1BlueHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeBlueHue.
func (ThemeBlueHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeBlueHue"
}

// +k8s:openapi-gen=true
type ThemePurpleHue struct {
	Name   string                         `json:"name"`
	Shades []ThemeV0alpha1PurpleHueShades `json:"shades"`
}

// NewThemePurpleHue creates a new ThemePurpleHue object.
func NewThemePurpleHue() *ThemePurpleHue {
	return &ThemePurpleHue{
		Name:   "purple",
		Shades: []ThemeV0alpha1PurpleHueShades{},
	}
}

// OpenAPIModelName returns the OpenAPI model name for ThemePurpleHue.
func (ThemePurpleHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemePurpleHue"
}

// +k8s:openapi-gen=true
type ThemeSpec struct {
	Name          string                       `json:"name"`
	Id            string                       `json:"id"`
	Colors        *ThemeV0alpha1SpecColors     `json:"colors,omitempty"`
	Spacing       *ThemeV0alpha1SpecSpacing    `json:"spacing,omitempty"`
	Shape         *ThemeV0alpha1SpecShape      `json:"shape,omitempty"`
	Typography    *ThemeV0alpha1SpecTypography `json:"typography,omitempty"`
	Visualization *ThemeVisualization          `json:"visualization,omitempty"`
}

// NewThemeSpec creates a new ThemeSpec object.
func NewThemeSpec() *ThemeSpec {
	return &ThemeSpec{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeSpec.
func (ThemeSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeSpec"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1RedHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1RedHueShades creates a new ThemeV0alpha1RedHueShades object.
func NewThemeV0alpha1RedHueShades() *ThemeV0alpha1RedHueShades {
	return &ThemeV0alpha1RedHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1RedHueShades.
func (ThemeV0alpha1RedHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1RedHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1OrangeHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1OrangeHueShades creates a new ThemeV0alpha1OrangeHueShades object.
func NewThemeV0alpha1OrangeHueShades() *ThemeV0alpha1OrangeHueShades {
	return &ThemeV0alpha1OrangeHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1OrangeHueShades.
func (ThemeV0alpha1OrangeHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1OrangeHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1YellowHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1YellowHueShades creates a new ThemeV0alpha1YellowHueShades object.
func NewThemeV0alpha1YellowHueShades() *ThemeV0alpha1YellowHueShades {
	return &ThemeV0alpha1YellowHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1YellowHueShades.
func (ThemeV0alpha1YellowHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1YellowHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1GreenHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1GreenHueShades creates a new ThemeV0alpha1GreenHueShades object.
func NewThemeV0alpha1GreenHueShades() *ThemeV0alpha1GreenHueShades {
	return &ThemeV0alpha1GreenHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1GreenHueShades.
func (ThemeV0alpha1GreenHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1GreenHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1BlueHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1BlueHueShades creates a new ThemeV0alpha1BlueHueShades object.
func NewThemeV0alpha1BlueHueShades() *ThemeV0alpha1BlueHueShades {
	return &ThemeV0alpha1BlueHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1BlueHueShades.
func (ThemeV0alpha1BlueHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1BlueHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1PurpleHueShades struct {
	Color   string   `json:"color"`
	Name    string   `json:"name"`
	Aliases []string `json:"aliases,omitempty"`
	Primary *bool    `json:"primary,omitempty"`
}

// NewThemeV0alpha1PurpleHueShades creates a new ThemeV0alpha1PurpleHueShades object.
func NewThemeV0alpha1PurpleHueShades() *ThemeV0alpha1PurpleHueShades {
	return &ThemeV0alpha1PurpleHueShades{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1PurpleHueShades.
func (ThemeV0alpha1PurpleHueShades) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1PurpleHueShades"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsText struct {
	Primary     *string `json:"primary,omitempty"`
	Secondary   *string `json:"secondary,omitempty"`
	Disabled    *string `json:"disabled,omitempty"`
	Link        *string `json:"link,omitempty"`
	MaxContrast *string `json:"maxContrast,omitempty"`
}

// NewThemeV0alpha1SpecColorsText creates a new ThemeV0alpha1SpecColorsText object.
func NewThemeV0alpha1SpecColorsText() *ThemeV0alpha1SpecColorsText {
	return &ThemeV0alpha1SpecColorsText{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsText.
func (ThemeV0alpha1SpecColorsText) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsText"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsBackground struct {
	Canvas    *string `json:"canvas,omitempty"`
	Primary   *string `json:"primary,omitempty"`
	Secondary *string `json:"secondary,omitempty"`
	Elevated  *string `json:"elevated,omitempty"`
}

// NewThemeV0alpha1SpecColorsBackground creates a new ThemeV0alpha1SpecColorsBackground object.
func NewThemeV0alpha1SpecColorsBackground() *ThemeV0alpha1SpecColorsBackground {
	return &ThemeV0alpha1SpecColorsBackground{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsBackground.
func (ThemeV0alpha1SpecColorsBackground) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsBackground"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsBorder struct {
	Weak   *string `json:"weak,omitempty"`
	Medium *string `json:"medium,omitempty"`
	Strong *string `json:"strong,omitempty"`
}

// NewThemeV0alpha1SpecColorsBorder creates a new ThemeV0alpha1SpecColorsBorder object.
func NewThemeV0alpha1SpecColorsBorder() *ThemeV0alpha1SpecColorsBorder {
	return &ThemeV0alpha1SpecColorsBorder{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsBorder.
func (ThemeV0alpha1SpecColorsBorder) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsBorder"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsGradients struct {
	BrandVertical   *string `json:"brandVertical,omitempty"`
	BrandHorizontal *string `json:"brandHorizontal,omitempty"`
}

// NewThemeV0alpha1SpecColorsGradients creates a new ThemeV0alpha1SpecColorsGradients object.
func NewThemeV0alpha1SpecColorsGradients() *ThemeV0alpha1SpecColorsGradients {
	return &ThemeV0alpha1SpecColorsGradients{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsGradients.
func (ThemeV0alpha1SpecColorsGradients) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsGradients"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsAction struct {
	Selected           *string  `json:"selected,omitempty"`
	SelectedBorder     *string  `json:"selectedBorder,omitempty"`
	Hover              *string  `json:"hover,omitempty"`
	HoverOpacity       *float64 `json:"hoverOpacity,omitempty"`
	Focus              *string  `json:"focus,omitempty"`
	DisabledBackground *string  `json:"disabledBackground,omitempty"`
	DisabledText       *string  `json:"disabledText,omitempty"`
	DisabledOpacity    *float64 `json:"disabledOpacity,omitempty"`
}

// NewThemeV0alpha1SpecColorsAction creates a new ThemeV0alpha1SpecColorsAction object.
func NewThemeV0alpha1SpecColorsAction() *ThemeV0alpha1SpecColorsAction {
	return &ThemeV0alpha1SpecColorsAction{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsAction.
func (ThemeV0alpha1SpecColorsAction) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsAction"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColors struct {
	Mode              *ThemeV0alpha1SpecColorsMode       `json:"mode,omitempty"`
	Primary           *ThemeColorSection                 `json:"primary,omitempty"`
	Secondary         *ThemeColorSection                 `json:"secondary,omitempty"`
	Info              *ThemeColorSection                 `json:"info,omitempty"`
	Error             *ThemeColorSection                 `json:"error,omitempty"`
	Success           *ThemeColorSection                 `json:"success,omitempty"`
	Warning           *ThemeColorSection                 `json:"warning,omitempty"`
	Text              *ThemeV0alpha1SpecColorsText       `json:"text,omitempty"`
	Background        *ThemeV0alpha1SpecColorsBackground `json:"background,omitempty"`
	Border            *ThemeV0alpha1SpecColorsBorder     `json:"border,omitempty"`
	Gradients         *ThemeV0alpha1SpecColorsGradients  `json:"gradients,omitempty"`
	Action            *ThemeV0alpha1SpecColorsAction     `json:"action,omitempty"`
	Scrollbar         *string                            `json:"scrollbar,omitempty"`
	HoverFactor       *float64                           `json:"hoverFactor,omitempty"`
	ContrastThreshold *float64                           `json:"contrastThreshold,omitempty"`
	TonalOffset       *float64                           `json:"tonalOffset,omitempty"`
}

// NewThemeV0alpha1SpecColors creates a new ThemeV0alpha1SpecColors object.
func NewThemeV0alpha1SpecColors() *ThemeV0alpha1SpecColors {
	return &ThemeV0alpha1SpecColors{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColors.
func (ThemeV0alpha1SpecColors) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColors"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecSpacing struct {
	GridSize *int64 `json:"gridSize,omitempty"`
}

// NewThemeV0alpha1SpecSpacing creates a new ThemeV0alpha1SpecSpacing object.
func NewThemeV0alpha1SpecSpacing() *ThemeV0alpha1SpecSpacing {
	return &ThemeV0alpha1SpecSpacing{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecSpacing.
func (ThemeV0alpha1SpecSpacing) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecSpacing"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecShape struct {
	BorderRadius *int64 `json:"borderRadius,omitempty"`
}

// NewThemeV0alpha1SpecShape creates a new ThemeV0alpha1SpecShape object.
func NewThemeV0alpha1SpecShape() *ThemeV0alpha1SpecShape {
	return &ThemeV0alpha1SpecShape{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecShape.
func (ThemeV0alpha1SpecShape) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecShape"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecTypography struct {
	FontFamily          *string  `json:"fontFamily,omitempty"`
	FontFamilyMonospace *string  `json:"fontFamilyMonospace,omitempty"`
	FontSize            *float64 `json:"fontSize,omitempty"`
	FontWeightLight     *float64 `json:"fontWeightLight,omitempty"`
	FontWeightRegular   *float64 `json:"fontWeightRegular,omitempty"`
	FontWeightMedium    *float64 `json:"fontWeightMedium,omitempty"`
	FontWeightBold      *float64 `json:"fontWeightBold,omitempty"`
	HtmlFontSize        *float64 `json:"htmlFontSize,omitempty"`
}

// NewThemeV0alpha1SpecTypography creates a new ThemeV0alpha1SpecTypography object.
func NewThemeV0alpha1SpecTypography() *ThemeV0alpha1SpecTypography {
	return &ThemeV0alpha1SpecTypography{}
}

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecTypography.
func (ThemeV0alpha1SpecTypography) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecTypography"
}

// +k8s:openapi-gen=true
type ThemeV0alpha1SpecColorsMode string

const (
	ThemeV0alpha1SpecColorsModeLight ThemeV0alpha1SpecColorsMode = "light"
	ThemeV0alpha1SpecColorsModeDark  ThemeV0alpha1SpecColorsMode = "dark"
)

// OpenAPIModelName returns the OpenAPI model name for ThemeV0alpha1SpecColorsMode.
func (ThemeV0alpha1SpecColorsMode) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeV0alpha1SpecColorsMode"
}

// +k8s:openapi-gen=true
type ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue struct {
	RedHue    *ThemeRedHue    `json:"RedHue,omitempty"`
	OrangeHue *ThemeOrangeHue `json:"OrangeHue,omitempty"`
	YellowHue *ThemeYellowHue `json:"YellowHue,omitempty"`
	GreenHue  *ThemeGreenHue  `json:"GreenHue,omitempty"`
	BlueHue   *ThemeBlueHue   `json:"BlueHue,omitempty"`
	PurpleHue *ThemePurpleHue `json:"PurpleHue,omitempty"`
}

// NewThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue creates a new ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue object.
func NewThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue() *ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue {
	return &ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue{}
}

// MarshalJSON implements a custom JSON marshalling logic to encode `ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue` as JSON.
func (resource ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) MarshalJSON() ([]byte, error) {
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

// UnmarshalJSON implements a custom JSON unmarshalling logic to decode `ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue` from JSON.
func (resource *ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) UnmarshalJSON(raw []byte) error {
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
		var themeBlueHue ThemeBlueHue
		if err := json.Unmarshal(raw, &themeBlueHue); err != nil {
			return err
		}

		resource.BlueHue = &themeBlueHue
		return nil
	case "green":
		var themeGreenHue ThemeGreenHue
		if err := json.Unmarshal(raw, &themeGreenHue); err != nil {
			return err
		}

		resource.GreenHue = &themeGreenHue
		return nil
	case "orange":
		var themeOrangeHue ThemeOrangeHue
		if err := json.Unmarshal(raw, &themeOrangeHue); err != nil {
			return err
		}

		resource.OrangeHue = &themeOrangeHue
		return nil
	case "purple":
		var themePurpleHue ThemePurpleHue
		if err := json.Unmarshal(raw, &themePurpleHue); err != nil {
			return err
		}

		resource.PurpleHue = &themePurpleHue
		return nil
	case "red":
		var themeRedHue ThemeRedHue
		if err := json.Unmarshal(raw, &themeRedHue); err != nil {
			return err
		}

		resource.RedHue = &themeRedHue
		return nil
	case "yellow":
		var themeYellowHue ThemeYellowHue
		if err := json.Unmarshal(raw, &themeYellowHue); err != nil {
			return err
		}

		resource.YellowHue = &themeYellowHue
		return nil
	}

	return nil
}

// OpenAPIModelName returns the OpenAPI model name for ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue.
func (ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.theme.pkg.apis.theme.v0alpha1.ThemeRedHueOrOrangeHueOrYellowHueOrGreenHueOrBlueHueOrPurpleHue"
}
