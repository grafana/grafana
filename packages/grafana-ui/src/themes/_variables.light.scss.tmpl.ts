/* eslint-disable max-len */

import { GrafanaTheme } from '@grafana/data';
import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';
import { styleMixins } from '.';

export const lightThemeVarsTemplate = (theme: GrafanaTheme) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/light.ts', 'grafana-ui/src/themes/_variable.light.scss.tmpl.ts')}
// Global values
// --------------------------------------------------

$theme-name: light;

// New Colors
// -------------------------
$blue-light: ${theme.palette.blue95};
$blue-base: ${theme.palette.blue80};
$blue-shade: ${theme.palette.blue77};
$red-base: ${theme.palette.redBase};
$red-shade: ${theme.palette.redShade};
$green-base: ${theme.palette.greenBase};
$green-shade: ${theme.palette.greenShade};
$orange-dark: ${theme.palette.orangeDark};

$gray98: ${theme.palette.gray98};
$gray95: ${theme.palette.gray95};
$gray85: ${theme.palette.gray85};
$gray70: ${theme.palette.gray70};
$gray60: ${theme.palette.gray60};
$gray33: ${theme.palette.gray33};
$gray25: ${theme.palette.gray25};
$gray15: ${theme.palette.gray15};
$gray10: ${theme.palette.gray10};
$gray05: ${theme.palette.gray05};

// Grays
// -------------------------
$black: ${theme.palette.black};

$dark-1: ${theme.palette.dark1};
$dark-2: ${theme.palette.dark2};
$dark-4: ${theme.palette.dark4};
$dark-10: ${theme.palette.dark10};
$gray-1: ${theme.palette.gray1};
$gray-2: ${theme.palette.gray2};
$gray-3: ${theme.palette.gray3};
$gray-4: ${theme.palette.gray4};
$gray-5: ${theme.palette.gray5};
$gray-6: ${theme.palette.gray6};
$gray-7: ${theme.palette.gray7};

$white: ${theme.palette.white};

// Accent colors
// -------------------------
$blue: ${theme.colors.textBlue};
$red: $red-base;
$yellow: ${theme.palette.yellow};
$orange: ${theme.palette.orange};
$purple: ${theme.palette.purple};
$variable: ${theme.colors.textBlue};

$brand-primary: ${theme.palette.brandPrimary};
$brand-success: ${theme.palette.brandSuccess};
$brand-warning: ${theme.palette.brandWarning};
$brand-danger: ${theme.palette.brandDanger};

$query-red: ${theme.palette.queryRed};
$query-green: ${theme.palette.queryGreen};
$query-purple: ${theme.palette.queryPurple};
$query-orange: ${theme.palette.orange};

// Status colors
// -------------------------
$online: ${theme.palette.online};
$warn: ${theme.palette.warn};
$critical: ${theme.palette.critical};

// Scaffolding
// -------------------------
$body-bg: ${theme.colors.bodyBg};
$page-bg: ${theme.colors.bodyBg};
$dashboard-bg: ${theme.colors.dashboardBg};

$text-color: ${theme.colors.text};
$text-color-strong: ${theme.colors.textStrong};
$text-color-semi-weak: ${theme.colors.textSemiWeak};
$text-color-weak: ${theme.colors.textWeak};
$text-color-faint: ${theme.colors.textFaint};
$text-color-emphasis: ${theme.colors.textStrong};
$text-blue: ${theme.colors.textBlue};

$text-shadow-faint: none;

// gradients
$brand-gradient-horizontal: linear-gradient(to right, #f05a28 30%, #fbca0a 99%);
$brand-gradient-vertical: linear-gradient(#f05a28 30%, #fbca0a 99%);

// Links
// -------------------------
$link-color: ${theme.colors.link};
$link-color-disabled: ${theme.colors.linkDisabled};
$link-hover-color: ${theme.colors.linkHover};
$external-link-color: ${theme.colors.linkExternal};

// Typography
// -------------------------
$headings-color: ${theme.colors.textHeading};
$abbr-border-color: $gray-2 !default;
$text-muted: $text-color-weak;

$hr-border-color: $gray-4 !default;

// Panel
// -------------------------
$panel-bg: ${theme.colors.panelBg};
$panel-border: 1px solid ${theme.colors.panelBorder};
$panel-header-hover-bg: ${theme.colors.bg2};
$panel-corner: $gray-4;

// Page header
$page-header-bg: ${theme.colors.pageHeaderBg};
$page-header-shadow: inset 0px -3px 10px $gray-6;
$page-header-border-color: ${theme.colors.pageHeaderBorder};

$divider-border-color: $gray-2;

// Graphite Target Editor
$tight-form-func-bg: $gray-5;
$tight-form-func-highlight-bg: $gray-6;

$modal-backdrop-bg: ${theme.colors.bg1};
$code-tag-bg: $gray-6;
$code-tag-border: $gray-4;

// cards
$card-background: ${theme.colors.bg2};
$card-background-hover: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
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
$table-bg-accent: ${styleMixins.hoverColor(theme.colors.bg1, theme)};
$table-border: $gray-3; // table and cell border

$table-bg-odd: $gray-6;
$table-bg-hover: $gray-5;

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
$input-bg: $white;
$input-bg-disabled: $gray-5;

$input-color: ${theme.colors.formInputText};
$input-border-color: ${theme.colors.formInputBorder};
$input-box-shadow: none;
$input-border-focus: ${theme.palette.blue95};
$input-box-shadow-focus: ${theme.palette.blue95};
$input-color-placeholder: ${theme.colors.formInputPlaceholderText};
$input-label-bg: ${theme.colors.bg2};
$input-color-select-arrow: ${theme.palette.gray60};

// search
$search-shadow: 0 1px 5px 0 $gray-5;

// Typeahead
$typeahead-shadow: 0 5px 10px 0 $gray-5;
$typeahead-selected-bg: $gray-6;
$typeahead-selected-color: $yellow;

// Dropdowns
// -------------------------
$dropdownBackground: $white;
$dropdownBorder: $gray-4;
$dropdownDividerTop: $gray-6;
$dropdownDividerBottom: $gray-4;

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

$navbarButtonBackground: $panel-bg;
$navbar-button-border: $gray-4;

// Sidemenu
// -------------------------
$side-menu-bg: ${theme.palette.gray15};
$side-menu-border: 1px solid ${theme.palette.gray25};
$side-menu-bg-mobile: rgba(0, 0, 0, 0); //$gray-6;
$side-menu-item-hover-bg: ${theme.palette.gray25};
$side-menu-shadow: 5px 0px 10px -5px $gray-1;
$side-menu-link-color: $gray-4;
$side-menu-icon-color: ${theme.palette.gray70};
$side-menu-header-color: ${theme.palette.gray95};

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: $panel-bg;
$menu-dropdown-hover-bg: $gray-6;
$menu-dropdown-shadow: 5px 5px 10px -5px $gray-1;

// Tabs
// -------------------------
$tab-border-color: $gray-5;

// Toolbar
$toolbar-bg: white;

// Form states and alerts
// -------------------------
$warning-text-color: lighten($orange, 10%);
$error-text-color: $red-shade;
$success-text-color: lighten($green-base, 10%);

$alert-error-bg: linear-gradient(90deg, $red-base, $red-shade);
$alert-success-bg: linear-gradient(90deg, $green-base, $green-shade);
$alert-warning-bg: linear-gradient(90deg, $red-base, $red-shade);
$alert-info-bg: linear-gradient(100deg, $blue-base, $blue-shade);

// Tooltips and popovers
$tooltipBackground: $gray-1;
$tooltipColor: $gray-7;
$tooltipArrowColor: $tooltipBackground; // Used by Angular tooltip
$tooltipBackgroundError: $brand-danger;
$tooltipShadow: 0 0 5px $gray60;
$graph-tooltip-bg: $gray-5;

$tooltipArrowWidth: 5px;
$tooltipLinkColor: lighten($tooltipColor, 5%);

$popover-bg: $page-bg;
$popover-color: $text-color;
$popover-border-color: $gray-5;
$popover-header-bg: $gray-5;
$popover-shadow: 0 0 20px $white;

$popover-error-bg: $btn-danger-bg;
$popover-help-bg: $tooltipBackground;
$popover-help-color: $tooltipColor;

// images
$checkboxImageUrl: '../img/checkbox_white.png';

// info box
$info-box-border-color: $blue-base;

// footer
$footer-link-color: $gray-3;
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
$diff-label-bg: $gray-7;
$diff-label-fg: $gray-2;

$diff-arrow-color: $dark-2;
$diff-group-bg: $gray-6;

$diff-json-bg: $gray-6;
$diff-json-fg: $gray-1;

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
$switch-slider-on-bg: ${theme.palette.blue77};
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
$panel-editor-viz-item-bg: $white;
$panel-editor-tabs-line-color: $dark-2;

$panel-editor-viz-item-bg-hover: lighten($blue-base, 45%);

$panel-options-group-border: none;
$panel-options-group-header-bg: $gray-5;

$panel-grid-placeholder-bg: lighten(${theme.palette.blue95}, 30%);
$panel-grid-placeholder-shadow: 0 0 4px ${theme.palette.blue95};

// logs
$logs-color-unkown: $gray-5;

// toggle-group
$button-toggle-group-btn-active-bg: $brand-primary;
$button-toggle-group-btn-active-shadow: inset 0 0 4px $white;
$button-toggle-group-btn-seperator-border: 1px solid $gray-6;

$vertical-resize-handle-bg: $gray-4;
$vertical-resize-handle-dots: $gray-3;
$vertical-resize-handle-dots-hover: $gray-2;

// Calendar
$calendar-bg-days: $white;
$calendar-bg-now: $gray-6;
`;
