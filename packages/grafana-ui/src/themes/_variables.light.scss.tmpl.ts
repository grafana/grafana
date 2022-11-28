/* eslint-disable max-len */

import { GrafanaTheme2 } from '@grafana/data';

import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';

import { styleMixins } from '.';

export const lightThemeVarsTemplate = (theme: GrafanaTheme2) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/light.ts', 'grafana-ui/src/themes/_variable.light.scss.tmpl.ts')}
// Global values
// --------------------------------------------------

$theme-name: light;

$colors-action-hover: ${theme.colors.action.hover};
$colors-action-selected: ${theme.colors.action.selected};

// New Colors
// -------------------------
$blue-light: ${theme.colors.primary.text};
$blue-base: ${theme.colors.primary.main};
$blue-shade: ${theme.colors.primary.shade};
$red-base: ${theme.colors.error.main};
$red-shade: ${theme.colors.error.shade};
$green-base: ${theme.colors.success.main};
$green-shade: ${theme.colors.success.shade};
$orange-dark: ${theme.v1.palette.orangeDark};

$gray98: ${theme.v1.palette.gray98};
$gray95: ${theme.v1.palette.gray95};
$gray85: ${theme.v1.palette.gray85};
$gray70: ${theme.v1.palette.gray70};
$gray60: ${theme.v1.palette.gray60};
$gray33: ${theme.v1.palette.gray33};
$gray25: ${theme.v1.palette.gray25};
$gray15: ${theme.v1.palette.gray15};
$gray10: ${theme.v1.palette.gray10};
$gray05: ${theme.v1.palette.gray05};

// Grays
// -------------------------
$black: ${theme.v1.palette.black};

$dark-1: ${theme.v1.palette.dark1};
$dark-2: ${theme.v1.palette.dark2};
$dark-4: ${theme.v1.palette.dark4};
$dark-10: ${theme.v1.palette.dark10};
$gray-1: ${theme.v1.palette.gray1};
$gray-2: ${theme.v1.palette.gray2};
$gray-3: ${theme.v1.palette.gray3};
$gray-4: ${theme.v1.palette.gray4};
$gray-5: ${theme.v1.palette.gray5};
$gray-6: ${theme.v1.palette.gray6};
$gray-7: ${theme.v1.palette.gray7};

$white: ${theme.v1.palette.white};

$layer0: ${theme.colors.background.canvas};
$layer1: ${theme.colors.background.primary};
$layer2: ${theme.colors.background.secondary};

$divider: ${theme.colors.border.weak};
$border0: ${theme.colors.border.weak};
$border1: ${theme.colors.border.medium};

// Accent colors
// -------------------------
$blue: ${theme.colors.primary.text};
$red: $red-base;
$yellow: ${theme.v1.palette.yellow};
$orange: ${theme.v1.palette.orange};
$purple: ${theme.v1.palette.purple};
$variable: ${theme.colors.primary.text};

$brand-primary: ${theme.v1.palette.orange};
$brand-success: ${theme.colors.success.main};
$brand-warning: ${theme.colors.warning.main};
$brand-danger: ${theme.colors.error.main};

$query-red: ${theme.colors.error.text};
$query-green: ${theme.colors.success.text};
$query-purple: #fe85fc;
$query-orange: ${theme.v1.palette.orange};

// Status colors
// -------------------------
$online: ${theme.colors.success.text};
$warn: ${theme.colors.warning.text};
$critical: ${theme.colors.error.text};


// Scaffolding
// -------------------------
$body-bg: ${theme.colors.background.canvas};
$page-bg: ${theme.colors.background.canvas};
$dashboard-bg: ${theme.colors.background.canvas};

$text-color: ${theme.colors.text.primary};
$text-color-strong: ${theme.colors.text.maxContrast};
$text-color-semi-weak: ${theme.colors.text.secondary};
$text-color-weak: ${theme.colors.text.secondary};
$text-color-faint: ${theme.colors.text.disabled};
$text-color-emphasis: ${theme.colors.text.maxContrast};
$text-blue: ${theme.colors.primary.text};

$text-shadow-faint: none;

// gradients
$brand-gradient-horizontal: ${theme.colors.gradients.brandHorizontal};
$brand-gradient-vertical: ${theme.colors.gradients.brandVertical};

// Links
// -------------------------
$link-color: ${theme.colors.text.primary};
$link-color-disabled: ${theme.colors.text.disabled};
$link-hover-color: ${theme.colors.text.maxContrast};
$external-link-color: ${theme.colors.text.link};

// Typography
// -------------------------
$headings-color: ${theme.colors.text.primary};
$abbr-border-color: $gray-2 !default;
$text-muted: $text-color-weak;

$hr-border-color: $gray-4 !default;

// Panel
// -------------------------
$panel-bg: ${theme.components.panel.background};
$panel-border: 1px solid ${theme.components.panel.borderColor};
$panel-header-hover-bg: ${theme.colors.action.hover};
$panel-box-shadow: ${theme.components.panel.boxShadow};
$panel-corner: $panel-bg;

// Page header
$page-header-bg: ${theme.colors.background.canvas};
$page-header-shadow: inset 0px -3px 10px $gray-6;
$page-header-border-color: ${theme.colors.background.canvas};

$divider-border-color: $gray-2;

// Graphite Target Editor
$tight-form-func-bg: ${theme.colors.background.secondary};
$tight-form-func-highlight-bg: ${styleMixins.hoverColor(theme.colors.background.secondary, theme)};

$modal-backdrop-bg: ${theme.colors.background.primary};
$code-tag-bg: $gray-6;
$code-tag-border: $gray-4;

// cards
$card-background: ${theme.colors.background.secondary};
$card-background-hover: ${theme.colors.background.secondary};
$card-shadow: none;

// Lists
$list-item-bg: $gray-7;
$list-item-hover-bg: $gray-6;
$list-item-shadow: $card-shadow;

$empty-list-cta-bg: $gray-6;

// Scrollbars
$scrollbarBackground: $gray-4;
$scrollbarBackground2: $gray-4;
$scrollbarBorder: $gray-7;

// Tables
// -------------------------
$table-bg-accent: ${theme.colors.background.secondary};
$table-border: ${theme.colors.border.medium};
$table-bg-odd: ${theme.colors.emphasize(theme.colors.background.primary, 0.02)};
$table-bg-hover: ${theme.colors.emphasize(theme.colors.background.primary, 0.05)};

// Buttons
// -------------------------
$btn-secondary-bg: $gray-5;
$btn-secondary-bg-hl: $gray-4;

$btn-primary-bg: $blue-base;
$btn-primary-bg-hl: $blue-shade;

$btn-success-bg: $green-base;
$btn-success-bg-hl: $green-shade;

$btn-danger-bg: $red-base;
$btn-danger-bg-hl: $red-shade;

$btn-inverse-bg: $gray-5;
$btn-inverse-bg-hl: $gray-4;
$btn-inverse-text-color: $gray-1;
$btn-inverse-text-shadow: 0 1px 0 rgba(255, 255, 255, 0.4);

$btn-link-color: $gray-1;

$iconContainerBackground: $white;

$btn-divider-left: $gray-4;
$btn-divider-right: $gray-7;

$btn-drag-image: '../img/grab_light.svg';

$navbar-btn-gicon-brightness: brightness(1.5);

$btn-active-box-shadow: 0px 0px 4px rgba(234, 161, 51, 0.6);

// Forms
// -------------------------
$input-bg: ${theme.components.input.background};
$input-bg-disabled: ${theme.colors.action.disabledBackground};

$input-color: ${theme.components.input.text};
$input-border-color: ${theme.components.input.borderColor};
$input-box-shadow: none;
$input-border-focus: ${theme.v1.palette.blue95};
$input-box-shadow-focus: ${theme.v1.palette.blue95};
$input-color-placeholder: ${theme.colors.text.disabled};
$input-label-bg: ${theme.colors.background.secondary};
$input-color-select-arrow: ${theme.v1.palette.gray60};

// search
$search-shadow: 0 1px 5px 0 $gray-5;

// Typeahead
$typeahead-shadow: 0 5px 10px 0 $gray-5;
$typeahead-selected-bg: $gray-6;
$typeahead-selected-color: $yellow;

// Dropdowns
// -------------------------
$dropdownBackground: ${theme.colors.background.primary};
$dropdownBorder: ${theme.colors.border.weak};
$dropdownDividerTop: ${theme.colors.border.weak};
$dropdownDividerBottom: ${theme.colors.border.weak};
$dropdownShadow: ${theme.shadows.z3};

$dropdownLinkColor: $dark-2;
$dropdownLinkColorHover: $link-color;
$dropdownLinkColorActive: $link-color;

$dropdownLinkBackgroundHover: $gray-6;

// Horizontal forms & lists
// -------------------------
$horizontalComponentOffset: 180px;

// Navbar
// -------------------------
$navbarHeight: 52px;
$navbarBorder: 1px solid $gray-5;

// Sidemenu
// -------------------------
$side-menu-bg: ${theme.v1.palette.gray15};
$side-menu-border: 1px solid ${theme.v1.palette.gray25};
$side-menu-bg-mobile: rgba(0, 0, 0, 0); //$gray-6;
$side-menu-item-hover-bg: ${theme.v1.palette.gray25};
$side-menu-shadow: 5px 0px 10px -5px $gray-1;
$side-menu-link-color: $gray-4;
$side-menu-icon-color: ${theme.v1.palette.gray70};
$side-menu-header-color: ${theme.v1.palette.gray95};

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: ${theme.colors.background.primary};
$menu-dropdown-hover-bg: ${theme.colors.action.hover};
$menu-dropdown-shadow: ${theme.shadows.z3};

// Tabs
// -------------------------
$tab-border-color: $gray-5;

// Form states and alerts
// -------------------------
$warning-text-color: ${theme.colors.warning.text};
$error-text-color: ${theme.colors.error.text};
$success-text-color: ${theme.colors.success.text};

$alert-error-bg: ${theme.colors.error.main};
$alert-success-bg: ${theme.colors.success.main};
$alert-warning-bg: ${theme.colors.warning.main};
$alert-info-bg: ${theme.colors.warning.main};

// Tooltips and popovers
$tooltipBackground: ${theme.components.tooltip.background};
$tooltipColor: ${theme.components.tooltip.text};
$tooltipArrowColor: ${theme.components.tooltip.background};
$tooltipBackgroundError: ${theme.colors.error.main};
$tooltipShadow: ${theme.shadows.z2};

$popover-bg: ${theme.colors.background.primary};
$popover-color: ${theme.colors.text.primary};
$popover-border-color: ${theme.colors.border.weak};
$popover-header-bg: ${theme.colors.background.secondary};
$popover-shadow: ${theme.shadows.z3};

$graph-tooltip-bg: $gray-5;

$tooltipArrowWidth: 5px;
$tooltipLinkColor: lighten($tooltipColor, 5%);
$tooltipExternalLinkColor: #6E9FFF;

$popover-error-bg: $btn-danger-bg;
$popover-help-bg: $tooltipBackground;
$popover-help-color: $tooltipColor;

$popover-code-bg: ${theme.colors.background.primary};
$popover-code-boxshadow: 0 0 5px $gray60;

// images
$checkboxImageUrl: '../img/checkbox_white.png';

// info box
$info-box-border-color: $blue-base;

// footer
$footer-link-color: $gray-1;
$footer-link-hover: $dark-2;

// json explorer
$json-explorer-default-color: black;
$json-explorer-string-color: green;
$json-explorer-number-color: $blue-base;
$json-explorer-boolean-color: $red-base;
$json-explorer-null-color: #855a00;
$json-explorer-undefined-color: rgb(202, 11, 105);
$json-explorer-function-color: #ff20ed;
$json-explorer-rotate-time: 100ms;
$json-explorer-toggler-opacity: 0.6;
$json-explorer-bracket-color: $blue-base;
$json-explorer-key-color: #00008b;
$json-explorer-url-color: $blue-base;

// Changelog and diff
// -------------------------
$diff-label-bg: ${theme.colors.action.hover};
$diff-label-fg: $gray-2;

$diff-arrow-color: $dark-2;
$diff-group-bg: ${theme.colors.background.secondary};

$diff-json-bg: ${theme.colors.background.secondary};
$diff-json-fg: ${theme.colors.text.primary};

$diff-json-added: $blue-shade;
$diff-json-deleted: $red-shade;

$diff-json-old: #5a372a;
$diff-json-new: #664e33;

$diff-json-changed-fg: $gray-7;
$diff-json-changed-num: $gray-4;

$diff-json-icon: $gray-4;

//Submenu
$variable-option-bg: $dropdownLinkBackgroundHover;

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
$checkbox-border: 1px solid $gray-3;
$checkbox-checked-bg: linear-gradient(0deg, #ff9830, #e55400);
$checkbox-color: $gray-7;

//Panel Edit
// -------------------------
$panel-editor-shadow: 0px 0px 8px $gray-3;
$panel-editor-side-menu-shadow: drop-shadow(0 0 2px $gray-3);
$panel-editor-viz-item-shadow: 0 0 4px $gray-3;
$panel-editor-viz-item-border: 1px solid $gray-3;
$panel-editor-viz-item-shadow-hover: 0 0 4px $blue-light;
$panel-editor-viz-item-border-hover: 1px solid $blue-light;
$panel-editor-viz-item-bg: $card-background;
$panel-editor-tabs-line-color: $dark-2;

$panel-editor-viz-item-bg-hover: lighten($blue-base, 45%);

$panel-grid-placeholder-bg: lighten(${theme.v1.palette.blue95}, 30%);
$panel-grid-placeholder-shadow: 0 0 4px ${theme.v1.palette.blue95};

// logs
$logs-color-unknown: $gray-5;

// toggle-group
$button-toggle-group-btn-active-bg: $brand-primary;
$button-toggle-group-btn-active-shadow: inset 0 0 4px $white;
$button-toggle-group-btn-separator-border: 1px solid $gray-6;

$vertical-resize-handle-bg: $gray-4;
$vertical-resize-handle-dots: $gray-3;
$vertical-resize-handle-dots-hover: $gray-2;

// Calendar
$calendar-bg-days: $white;
$calendar-bg-now: $gray-6;

`;
