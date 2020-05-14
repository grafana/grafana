/* eslint-disable max-len */

import { GrafanaTheme } from '@grafana/data';
import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';
import { styleMixins } from '.';

export const darkThemeVarsTemplate = (theme: GrafanaTheme) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/dark.ts', 'grafana-ui/src/themes/_variables.dark.scss.tmpl.ts')}
// Global values
// --------------------------------------------------

$theme-name: dark;

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
$dark-3: ${theme.palette.dark3};
$dark-4: ${theme.palette.dark4};
$dark-5: ${theme.palette.dark5};
$dark-6: ${theme.palette.dark6};
$dark-7: ${theme.palette.dark7};
$dark-8: ${theme.palette.dark8};
$dark-9: ${theme.palette.dark9};
$dark-10: ${theme.palette.dark10};
$gray-1: ${theme.palette.gray1};
$gray-2: ${theme.palette.gray2};
$gray-3: ${theme.palette.gray3};
$gray-4: ${theme.palette.gray4};
$gray-5: ${theme.palette.gray5};
$gray-6: ${theme.palette.gray6};

$input-black: ${theme.colors.formInputBg};

$white: ${theme.palette.white};

// Accent colors
// -------------------------
$blue: ${theme.palette.blue85};
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
// -------------------------¨
$online: ${theme.palette.online};
$warn: ${theme.palette.warn};
$critical: ${theme.palette.critical};

// Scaffolding
// -------------------------
$body-bg: ${theme.colors.bodyBg};
$page-bg: ${theme.colors.bodyBg};
$dashboard-bg: ${theme.colors.dashboardBg};

$text-color-strong: ${theme.colors.textStrong};
$text-color: ${theme.colors.text};
$text-color-semi-weak: ${theme.colors.textSemiWeak};
$text-color-weak: ${theme.colors.textWeak};
$text-color-faint: ${theme.colors.textFaint};
$text-color-emphasis: ${theme.colors.textStrong};
$text-blue: ${theme.colors.textBlue};

$text-shadow-faint: 1px 1px 4px rgb(45, 45, 45);
$textShadow: none;

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

$hr-border-color: $dark-9;

// Panel
// -------------------------
$panel-bg: ${theme.colors.panelBg};
$panel-border: 1px solid ${theme.colors.panelBorder};
$panel-header-hover-bg: ${theme.colors.bg2};
$panel-corner: $panel-bg;

// page header
$page-header-bg: ${theme.colors.pageHeaderBg};
$page-header-shadow: inset 0px -4px 14px $dark-3;
$page-header-border-color: ${theme.colors.pageHeaderBorder};

$divider-border-color: $gray-1;

// Graphite Target Editor
$tight-form-func-bg: $dark-9;
$tight-form-func-highlight-bg: $dark-10;

$modal-backdrop-bg: ${theme.colors.bg3};
$code-tag-bg: $dark-1;
$code-tag-border: $dark-9;

// cards
$card-background: ${theme.colors.bg2};
$card-background-hover: ${styleMixins.hoverColor(theme.colors.bg2, theme)};
$card-shadow: none;

// Lists
$list-item-bg: $card-background;
$list-item-hover-bg: $card-background-hover;
$list-item-shadow: $card-shadow;

$empty-list-cta-bg: ${theme.colors.bg2};

// Scrollbars
$scrollbarBackground: #404357;
$scrollbarBackground2: $dark-10;
$scrollbarBorder: black;

// Tables
// -------------------------
$table-bg-accent: ${styleMixins.hoverColor(theme.colors.bg1, theme)}; // for striping
$table-border: $dark-6; // table and cell border

$table-bg-odd: $dark-3;
$table-bg-hover: $dark-6;

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
$input-bg: $input-black;
$input-bg-disabled: $dark-6;

$input-color: ${theme.colors.formInputText};
$input-border-color: ${theme.colors.formInputBorder};
$input-box-shadow: none;
$input-border-focus: ${theme.palette.blue95};
$input-box-shadow-focus: $blue-light !default;
$input-color-placeholder: ${theme.colors.formInputPlaceholderText};
$input-label-bg: ${theme.colors.bg2};
$input-color-select-arrow: $white;

// Search
$search-shadow: 0 0 30px 0 $black;

// Typeahead
$typeahead-shadow: 0 5px 10px 0 $black;
$typeahead-selected-bg: $dark-9;
$typeahead-selected-color: $yellow;

// Dropdowns
// -------------------------
$dropdownBackground: $panel-bg;
$dropdownBorder: ${theme.colors.panelBorder};
$dropdownDividerTop: transparent;
$dropdownDividerBottom: ${theme.palette.gray25};

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

$navbarButtonBackground: $panel-bg;
$navbar-button-border: #2f2f32;

// Sidemenu
// -------------------------
$side-menu-bg: $panel-bg;
$side-menu-bg-mobile: $panel-bg;
$side-menu-border: none;
$side-menu-item-hover-bg: ${theme.colors.bg2};
$side-menu-shadow: 0 0 20px black;
$side-menu-icon-color: ${theme.palette.gray70};
$side-menu-header-color: ${theme.colors.text};

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: ${theme.colors.bg1};
$menu-dropdown-hover-bg: ${theme.colors.bg2};
$menu-dropdown-shadow: 5px 5px 20px -5px $black;

// Tabs
// -------------------------
$tab-border-color: $dark-9;

// Toolbar
$toolbar-bg: $input-black;

// Form states and alerts
// -------------------------
$warning-text-color: $warn;
$error-text-color: #e84d4d;
$success-text-color: #12d95a;

$alert-error-bg: linear-gradient(90deg, $red-base, $red-shade);
$alert-success-bg: linear-gradient(90deg, $green-base, $green-shade);
$alert-warning-bg: linear-gradient(90deg, $red-base, $red-shade);
$alert-info-bg: linear-gradient(100deg, $blue-base, $blue-shade);

// Tooltips and popovers
// -------------------------
$tooltipColor: $text-color;
$tooltipArrowWidth: 5px;
$tooltipLinkColor: $link-color;
$tooltipShadow: 0 0 10px black;
$graph-tooltip-bg: $dark-1;

$tooltipBackground: $gray15;
$tooltipColor: $text-color;
$tooltipArrowColor: $tooltipBackground;
$tooltipBackgroundError: $brand-danger;

$popover-bg: $dark-2;
$popover-color: $text-color;
$popover-border-color: $dark-9;
$popover-header-bg: $dark-9;
$popover-shadow: 0 0 20px black;

$popover-help-bg: $tooltipBackground;
$popover-help-color: $text-color;
$popover-error-bg: $btn-danger-bg;

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
$diff-label-bg: $dark-3;
$diff-label-fg: $white;

$diff-group-bg: $dark-9;
$diff-arrow-color: $white;

$diff-json-bg: $dark-9;
$diff-json-fg: $gray-5;

$diff-json-added: $blue-shade;
$diff-json-deleted: $red-shade;

$diff-json-old: #a04338;
$diff-json-new: #457740;

$diff-json-changed-fg: $gray-5;
$diff-json-changed-num: $text-color;

$diff-json-icon: $gray-5;

//Submenu
$variable-option-bg: $dropdownLinkBackgroundHover;

//Switch Slider
// -------------------------
$switch-bg: $input-bg;
$switch-slider-color: $dark-3;
$switch-slider-off-bg: $gray-1;
$switch-slider-on-bg: ${theme.palette.blue95};
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
$panel-editor-viz-item-bg: $input-black;
$panel-editor-tabs-line-color: #e3e3e3;

$panel-editor-viz-item-bg-hover: darken($blue-base, 46%);

$panel-options-group-border: none;
$panel-options-group-header-bg: ${theme.colors.bg2};

$panel-grid-placeholder-bg: darken(${theme.palette.blue77}, 30%);
$panel-grid-placeholder-shadow: 0 0 4px ${theme.palette.blue80};

// logs
$logs-color-unkown: $gray-2;

// toggle-group
$button-toggle-group-btn-active-bg: linear-gradient(90deg, #eb7b18, #d44a3a);
$button-toggle-group-btn-active-shadow: inset 0 0 4px $black;
$button-toggle-group-btn-seperator-border: 1px solid $dark-2;

$vertical-resize-handle-bg: $dark-10;
$vertical-resize-handle-dots: $gray-1;
$vertical-resize-handle-dots-hover: $gray-2;

// Calendar
$calendar-bg-days: $input-bg;
$calendar-bg-now: $dark-10;
`;
