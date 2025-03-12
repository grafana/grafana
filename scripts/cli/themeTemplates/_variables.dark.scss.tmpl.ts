/* eslint-disable max-len */

import { GrafanaTheme2 } from '@grafana/data';

import { renderGeneratedFileBanner } from './generatedFileBanner';

export const darkThemeVarsTemplate = (theme: GrafanaTheme2) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/dark.ts', 'grafana-ui/src/themes/_variables.dark.scss.tmpl.ts')}
@use 'sass:color';
// Global values
// --------------------------------------------------

$theme-name: dark;

// New Colors
// -------------------------
$blue-base: ${theme.colors.primary.main};
$red-base: ${theme.colors.error.main};
$green-base: ${theme.colors.success.main};

// Grays
// -------------------------
$black: ${theme.v1.palette.black};
$dark-1: ${theme.v1.palette.dark1};
$dark-3: ${theme.v1.palette.dark3};
$dark-6: ${theme.v1.palette.dark6};
$dark-9: ${theme.v1.palette.dark9};
$dark-10: ${theme.v1.palette.dark10};
$gray-1: ${theme.v1.palette.gray1};
$gray-2: ${theme.v1.palette.gray2};
$gray-6: ${theme.v1.palette.gray6};

$white: ${theme.v1.palette.white};

$layer2: ${theme.colors.background.secondary};

// Accent colors
// -------------------------
$blue: ${theme.v1.palette.blue85};
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

// page header
$page-header-bg: ${theme.colors.background.canvas};
$page-header-shadow: inset 0px -4px 14px $dark-3;
$page-header-border-color: ${theme.colors.background.canvas};

// Graphite Target Editor
$tight-form-func-bg: ${theme.colors.background.secondary};

$code-tag-bg: $dark-1;
$code-tag-border: $dark-9;

// cards
$card-background: ${theme.colors.background.secondary};
$card-background-hover: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
$card-shadow: none;

// Lists
$list-item-bg: $card-background;

$empty-list-cta-bg: ${theme.colors.background.secondary};

// Scrollbars
$scrollbarBackground: #404357;
$scrollbarBackground2: $dark-10;

// Tables
// -------------------------
$table-bg-accent: ${theme.colors.background.secondary};

// Buttons
// -------------------------
$btn-inverse-bg-hl: color.adjust($dark-6, $lightness: 4%);

$btn-divider-left: $dark-9;
$btn-divider-right: $dark-3;

$btn-drag-image: '../img/grab_dark.svg';

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

$dropdownLinkColor: $link-color;
$dropdownLinkColorHover: $white;
$dropdownLinkColorActive: $white;
$dropdownLinkBackgroundHover: $dark-9;

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
// -------------------------
$tooltipLinkColor: $link-color;
$tooltipExternalLinkColor: ${theme.colors.text.link};
$graph-tooltip-bg: $dark-1;

$tooltipBackground: ${theme.components.tooltip.background};
$tooltipColor: ${theme.components.tooltip.text};

$popover-bg: ${theme.colors.background.primary};
$popover-color: ${theme.colors.text.primary};
$popover-border-color: ${theme.colors.border.weak};
$popover-header-bg: ${theme.colors.background.secondary};
$popover-shadow: ${theme.shadows.z3};

$popover-help-bg: $tooltipBackground;
$popover-help-color: $text-color;
$popover-error-bg: $red-base;

// images
$checkboxImageUrl: '../img/checkbox.png';

// info box
$info-box-border-color: $blue-base;

//Switch Slider
// -------------------------
$switch-bg: $input-bg;
$switch-slider-color: $dark-3;
$switch-slider-off-bg: $gray-1;
$switch-slider-on-bg: ${theme.v1.palette.blue95};
$switch-slider-shadow: 0 0 3px black;

//Checkbox
// -------------------------
$checkbox-bg: $dark-1;
$checkbox-border: 1px solid $gray-1;
$checkbox-checked-bg: linear-gradient(0deg, #eb7b18, #d44a3a);
$checkbox-color: $dark-1;
`;
