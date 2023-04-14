/* eslint-disable max-len */

import { GrafanaTheme2 } from '@grafana/data';

import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';

export const darkThemeVarsTemplate = (theme: GrafanaTheme2) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/dark.ts', 'grafana-ui/src/themes/_variables.dark.scss.tmpl.ts')}
// Global values
// --------------------------------------------------

$theme-name: dark;

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
$dark-3: ${theme.v1.palette.dark3};
$dark-4: ${theme.v1.palette.dark4};
$dark-5: ${theme.v1.palette.dark5};
$dark-6: ${theme.v1.palette.dark6};
$dark-7: ${theme.v1.palette.dark7};
$dark-8: ${theme.v1.palette.dark8};
$dark-9: ${theme.v1.palette.dark9};
$dark-10: ${theme.v1.palette.dark10};
$gray-1: ${theme.v1.palette.gray1};
$gray-2: ${theme.v1.palette.gray2};
$gray-3: ${theme.v1.palette.gray3};
$gray-4: ${theme.v1.palette.gray4};
$gray-5: ${theme.v1.palette.gray5};
$gray-6: ${theme.v1.palette.gray6};

$white: ${theme.v1.palette.white};

$layer0: ${theme.colors.background.canvas};
$layer1: ${theme.colors.background.primary};
$layer2: ${theme.colors.background.secondary};

$divider: ${theme.colors.border.weak};

$border0: ${theme.colors.border.weak};
$border1: ${theme.colors.border.medium};

// Accent colors
// -------------------------
$blue: ${theme.v1.palette.blue85};
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
// -------------------------¨
$online: ${theme.colors.success.text};
$warn: ${theme.colors.warning.text};
$critical: ${theme.colors.error.text};

// Scaffolding
// -------------------------
$body-bg: ${theme.colors.background.canvas};
$page-bg: ${theme.colors.background.canvas};
$dashboard-bg: ${theme.colors.background.canvas};

$text-color-strong: ${theme.colors.text.maxContrast};
$text-color: ${theme.colors.text.primary};
$text-color-semi-weak: ${theme.colors.text.secondary};
$text-color-weak: ${theme.colors.text.secondary};
$text-color-faint: ${theme.colors.text.disabled};
$text-color-emphasis: ${theme.colors.text.maxContrast};
$text-blue: ${theme.colors.primary.text};

$text-shadow-faint: 1px 1px 4px rgb(45, 45, 45);
$textShadow: none;

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

$hr-border-color: $dark-9;

// Panel
// -------------------------
$panel-bg: ${theme.components.panel.background};
$panel-border: 1px solid ${theme.components.panel.borderColor};
$panel-header-hover-bg: ${theme.colors.action.hover};
$panel-box-shadow: ${theme.components.panel.boxShadow};
$panel-corner: $panel-bg;

// page header
$page-header-bg: ${theme.colors.background.canvas};
$page-header-shadow: inset 0px -4px 14px $dark-3;
$page-header-border-color: ${theme.colors.background.canvas};

$divider-border-color: $gray-1;

// Graphite Target Editor
$tight-form-func-bg: ${theme.colors.background.secondary};
$tight-form-func-highlight-bg: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};

$modal-backdrop-bg: ${theme.colors.action.hover};
$code-tag-bg: $dark-1;
$code-tag-border: $dark-9;

// cards
$card-background: ${theme.colors.background.secondary};
$card-background-hover: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
$card-shadow: none;

// Lists
$list-item-bg: $card-background;
$list-item-hover-bg: $card-background-hover;
$list-item-shadow: $card-shadow;

$empty-list-cta-bg: ${theme.colors.background.secondary};

// Scrollbars
$scrollbarBackground: #404357;
$scrollbarBackground2: $dark-10;
$scrollbarBorder: black;

// Tables
// -------------------------
$table-bg-accent: ${theme.colors.background.secondary};
$table-border: ${theme.colors.border.medium};
$table-bg-odd: ${theme.colors.emphasize(theme.colors.background.primary, 0.02)};
$table-bg-hover: ${theme.colors.emphasize(theme.colors.background.primary, 0.05)};

// Buttons
// -------------------------
$btn-primary-bg: $blue-base;
$btn-primary-bg-hl: $blue-shade;

$btn-secondary-bg: $dark-6;
$btn-secondary-bg-hl: lighten($dark-6, 4%);

$btn-success-bg: $green-base;
$btn-success-bg-hl: $green-shade;

$btn-danger-bg: $red-base;
$btn-danger-bg-hl: $red-shade;

$btn-inverse-bg: $dark-6;
$btn-inverse-bg-hl: lighten($dark-6, 4%);
$btn-inverse-text-color: $link-color;
$btn-inverse-text-shadow: 0px 1px 0 rgba(0, 0, 0, 0.1);

$btn-link-color: $gray-3;

$iconContainerBackground: $black;

$btn-divider-left: $dark-9;
$btn-divider-right: $dark-3;

$btn-drag-image: '../img/grab_dark.svg';

$navbar-btn-gicon-brightness: brightness(0.5);

$btn-active-box-shadow: 0px 0px 4px rgba(255, 120, 10, 0.5);

// Forms
// -------------------------
$input-bg: ${theme.components.input.background};
$input-bg-disabled: ${theme.colors.action.disabledBackground};

$input-color: ${theme.components.input.text};
$input-border-color: ${theme.components.input.borderColor};
$input-box-shadow: none;
$input-border-focus: ${theme.colors.primary.border};
$input-box-shadow-focus: ${theme.colors.primary.border} !default;
$input-color-placeholder: ${theme.colors.text.disabled};
$input-label-bg: ${theme.colors.background.secondary};
$input-color-select-arrow: $white;

// Search
$search-shadow: 0 0 30px 0 $black;

// Typeahead
$typeahead-shadow: 0 5px 10px 0 $black;
$typeahead-selected-bg: $dark-9;
$typeahead-selected-color: $yellow;

// Dropdowns
// -------------------------
$dropdownBackground: ${theme.colors.background.primary};
$dropdownBorder: ${theme.colors.border.weak};
$dropdownDividerTop: ${theme.colors.border.weak};
$dropdownDividerBottom: ${theme.colors.border.weak};
$dropdownShadow: ${theme.shadows.z3};

$dropdownLinkColor: $link-color;
$dropdownLinkColorHover: $white;
$dropdownLinkColorActive: $white;
$dropdownLinkBackgroundHover: $dark-9;

// Horizontal forms & lists
// -------------------------
$horizontalComponentOffset: 180px;

// Navbar
// -------------------------
$navbarHeight: 55px;
$navbarBorder: 1px solid $dark-6;

// Sidemenu
// -------------------------
$side-menu-bg: $panel-bg;
$side-menu-bg-mobile: $panel-bg;
$side-menu-border: none;
$side-menu-item-hover-bg: ${theme.colors.background.secondary};
$side-menu-shadow: 0 0 30px #111;
$side-menu-icon-color: ${theme.v1.palette.gray70};
$side-menu-header-color: ${theme.colors.text.primary};

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: ${theme.colors.background.primary};
$menu-dropdown-hover-bg: ${theme.colors.action.hover};
$menu-dropdown-shadow: ${theme.shadows.z3};

// Tabs
// -------------------------
$tab-border-color: $dark-9;

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
// -------------------------
$tooltipArrowWidth: 5px;
$tooltipLinkColor: $link-color;
$tooltipExternalLinkColor: $external-link-color;
$graph-tooltip-bg: $dark-1;

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

$popover-help-bg: $tooltipBackground;
$popover-help-color: $text-color;
$popover-error-bg: $btn-danger-bg;

$popover-code-bg: $popover-bg;
$popover-code-boxshadow: $tooltipShadow;

// images
$checkboxImageUrl: '../img/checkbox.png';

// info box
$info-box-border-color: $blue-base;

// footer
$footer-link-color: $gray-2;
$footer-link-hover: $gray-4;

// json-explorer
$json-explorer-default-color: $text-color;
$json-explorer-string-color: #23d662;
$json-explorer-number-color: $variable;
$json-explorer-boolean-color: $variable;
$json-explorer-null-color: #eec97d;
$json-explorer-undefined-color: rgb(239, 143, 190);
$json-explorer-function-color: #fd48cb;
$json-explorer-rotate-time: 100ms;
$json-explorer-toggler-opacity: 0.6;
$json-explorer-bracket-color: #9494ff;
$json-explorer-key-color: #23a0db;
$json-explorer-url-color: #027bff;

// Changelog and diff
// -------------------------
$diff-label-bg: ${theme.colors.action.hover};
$diff-label-fg: $white;

$diff-group-bg: ${theme.colors.background.secondary};
$diff-arrow-color: $white;

$diff-json-bg: ${theme.colors.background.secondary};
$diff-json-fg: ${theme.colors.text.primary};

$diff-json-added: $blue-shade;
$diff-json-deleted: $red-shade;

$diff-json-old: #a04338;
$diff-json-new: #457740;

$diff-json-changed-fg: $gray-5;
$diff-json-changed-num: $text-color;

$diff-json-icon: $gray-5;

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

//Panel Edit
// -------------------------
$panel-editor-shadow: 0 0 20px black;
$panel-editor-side-menu-shadow: drop-shadow(0 0 10px $black);
$panel-editor-viz-item-shadow: 0 0 8px $dark-10;
$panel-editor-viz-item-border: 1px solid $dark-10;
$panel-editor-viz-item-shadow-hover: 0 0 4px $blue-light;
$panel-editor-viz-item-border-hover: 1px solid $blue-light;
$panel-editor-viz-item-bg: $input-bg;
$panel-editor-tabs-line-color: #e3e3e3;

$panel-editor-viz-item-bg-hover: darken($blue-base, 46%);

$panel-grid-placeholder-bg: darken(${theme.v1.palette.blue77}, 30%);
$panel-grid-placeholder-shadow: 0 0 4px ${theme.v1.palette.blue80};

// logs
$logs-color-unknown: $gray-2;

// toggle-group
$button-toggle-group-btn-active-bg: linear-gradient(90deg, #eb7b18, #d44a3a);
$button-toggle-group-btn-active-shadow: inset 0 0 4px $black;
$button-toggle-group-btn-separator-border: 1px solid $dark-2;

$vertical-resize-handle-bg: $dark-10;
$vertical-resize-handle-dots: $gray-1;
$vertical-resize-handle-dots-hover: $gray-2;

// Calendar
$calendar-bg-days: $input-bg;
$calendar-bg-now: $dark-10;
`;
