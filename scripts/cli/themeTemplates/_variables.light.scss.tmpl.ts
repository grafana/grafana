import { GrafanaTheme2 } from '@grafana/data';

import { renderGeneratedFileBanner } from './generatedFileBanner';

export const lightThemeVarsTemplate = (theme: GrafanaTheme2) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/light.ts', 'grafana-ui/src/themes/_variable.light.scss.tmpl.ts')}
@use 'sass:color';
// Global values
// --------------------------------------------------

$theme-name: light;

// New Colors
// -------------------------
$blue-base: ${theme.colors.primary.main};
$red-base: ${theme.colors.error.main};
$green-base: ${theme.colors.success.main};

// Grays
// -------------------------
$black: ${theme.v1.palette.black};

$dark-2: ${theme.v1.palette.dark2};
$dark-10: ${theme.v1.palette.dark10};
$gray-1: ${theme.v1.palette.gray1};
$gray-2: ${theme.v1.palette.gray2};
$gray-4: ${theme.v1.palette.gray4};
$gray-5: ${theme.v1.palette.gray5};
$gray-6: ${theme.v1.palette.gray6};
$gray-7: ${theme.v1.palette.gray7};

$white: ${theme.v1.palette.white};

$layer2: ${theme.colors.background.secondary};

// Accent colors
// -------------------------
$blue: ${theme.colors.primary.text};
$red: $red-base;
$yellow: ${theme.v1.palette.yellow};
$purple: ${theme.v1.palette.purple};

// Scaffolding
// -------------------------
$body-bg: ${theme.colors.background.canvas};

$text-color: ${theme.colors.text.primary};
$text-color-weak: ${theme.colors.text.secondary};
$text-color-emphasis: ${theme.colors.text.maxContrast};

// Links
// -------------------------
$link-color: ${theme.colors.text.primary};
$link-color-disabled: ${theme.colors.text.disabled};
$link-hover-color: ${theme.colors.text.maxContrast};

// Typography
// -------------------------
$text-muted: $text-color-weak;

// Panel
// -------------------------
$panel-bg: ${theme.components.panel.background};

// Page header
$page-header-bg: ${theme.colors.background.canvas};
$page-header-shadow: inset 0px -3px 10px $gray-6;
$page-header-border-color: ${theme.colors.background.canvas};

// Graphite Target Editor
$tight-form-func-bg: ${theme.colors.background.secondary};

$code-tag-bg: $gray-6;
$code-tag-border: $gray-4;

// cards
$card-background: ${theme.colors.background.secondary};
$card-background-hover: ${theme.colors.background.secondary};
$card-shadow: none;

// Lists
$list-item-bg: $gray-7;

$empty-list-cta-bg: $gray-6;

// Scrollbars
$scrollbarBackground: $gray-4;
$scrollbarBackground2: $gray-4;

// Tables
// -------------------------
$table-bg-accent: ${theme.colors.background.secondary};

// Buttons
// -------------------------
$btn-inverse-bg-hl: $gray-4;

$btn-divider-left: $gray-4;
$btn-divider-right: $gray-7;

$btn-drag-image: '../img/grab_light.svg';

// Forms
// -------------------------
$input-bg: ${theme.components.input.background};

$input-color: ${theme.components.input.text};
$input-border-color: ${theme.components.input.borderColor};

// Dropdowns
// -------------------------
$dropdownBackground: ${theme.colors.background.primary};
$dropdownBorder: ${theme.colors.border.weak};
$dropdownDividerTop: ${theme.colors.border.weak};
$dropdownDividerBottom: ${theme.colors.border.weak};

$dropdownLinkColor: $dark-2;
$dropdownLinkColorHover: $link-color;
$dropdownLinkColorActive: $link-color;

$dropdownLinkBackgroundHover: $gray-6;

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: ${theme.colors.background.primary};
$menu-dropdown-hover-bg: ${theme.colors.action.hover};
$menu-dropdown-shadow: ${theme.shadows.z3};

// Form states and alerts
// -------------------------
$alert-error-bg: ${theme.colors.error.main};
$alert-success-bg: ${theme.colors.success.main};
$alert-warning-bg: ${theme.colors.warning.main};
$alert-info-bg: ${theme.colors.warning.main};

// Tooltips and popovers
$tooltipBackground: ${theme.components.tooltip.background};
$tooltipColor: ${theme.components.tooltip.text};

$popover-bg: ${theme.colors.background.primary};
$popover-color: ${theme.colors.text.primary};
$popover-border-color: ${theme.colors.border.weak};
$popover-header-bg: ${theme.colors.background.secondary};
$popover-shadow: ${theme.shadows.z3};

$graph-tooltip-bg: $gray-5;

$tooltipLinkColor: color.adjust($tooltipColor, $lightness: 5%);
$tooltipExternalLinkColor: #6e9fff;

$popover-error-bg: $red-base;
$popover-help-bg: $tooltipBackground;
$popover-help-color: $tooltipColor;

// images
$checkboxImageUrl: '../img/checkbox_white.png';

// info box
$info-box-border-color: $blue-base;

//Switch Slider
// -------------------------
$switch-bg: $white;
$switch-slider-color: $gray-7;
$switch-slider-off-bg: $gray-5;
$switch-slider-on-bg: ${theme.v1.palette.blue77};
$switch-slider-shadow: 0 0 3px $dark-2;

//Checkbox
// -------------------------
$checkbox-bg: $gray-6;
$checkbox-border: 1px solid ${theme.v1.palette.gray3};
$checkbox-checked-bg: linear-gradient(0deg, #ff9830, #e55400);
$checkbox-color: $gray-7;
`;
