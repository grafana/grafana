/* eslint-disable max-len */

import { GrafanaTheme } from '@grafana/data';
import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';

export const darkThemeVarsTemplate = (theme: GrafanaTheme) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/dark.ts', 'grafana-ui/src/themes/_variables.dark.scss.tmpl.ts')}
// Global values
// --------------------------------------------------

$theme-name: dark;

// New Colors
// -------------------------
$blue-faint: ${theme.colors.blueFaint};
$blue-light: ${theme.colors.blueLight};
$blue-base: ${theme.colors.blueBase};
$blue-shade: ${theme.colors.blueShade};
$red-base: ${theme.colors.redBase};
$red-shade: ${theme.colors.redShade};
$green-base: ${theme.colors.greenBase};
$green-shade: ${theme.colors.greenShade};
$orange-dark: ${theme.colors.orangeDark};

// Grays
// -------------------------
$black: ${theme.colors.black};
$dark-1: ${theme.colors.dark1};
$dark-2: ${theme.colors.dark2};
$dark-3: ${theme.colors.dark3};
$dark-4: ${theme.colors.dark4};
$dark-5: ${theme.colors.dark5};
$dark-6: ${theme.colors.dark6};
$dark-7: ${theme.colors.dark7};
$dark-8: ${theme.colors.dark8};
$dark-9: ${theme.colors.dark9};
$dark-10: ${theme.colors.dark10};
$gray-1: ${theme.colors.gray1};
$gray-2: ${theme.colors.gray2};
$gray-3: ${theme.colors.gray3};
$gray-4: ${theme.colors.gray4};
$gray-5: ${theme.colors.gray5};
$gray-6: ${theme.colors.gray6};

$gray-blue: ${theme.colors.grayBlue};
$input-black: #09090b;

$white: ${theme.colors.white};

// Accent colors
// -------------------------
$blue: ${theme.colors.blue};
$red: $red-base;
$yellow: ${theme.colors.yellow};
$orange: ${theme.colors.orange};
$purple: ${theme.colors.purple};
$variable: ${theme.colors.variable};

$brand-primary: ${theme.colors.brandPrimary};
$brand-success: ${theme.colors.brandSuccess};
$brand-warning: ${theme.colors.brandWarning};
$brand-danger: ${theme.colors.brandDanger};

$query-red: ${theme.colors.queryRed};
$query-green: ${theme.colors.queryGreen};
$query-purple: ${theme.colors.queryPurple};
$query-orange: ${theme.colors.orange};
$query-keyword: ${theme.colors.queryKeyword};

// Status colors
// -------------------------
$online: ${theme.colors.online};
$warn: ${theme.colors.warn};
$critical: ${theme.colors.critical};

// Scaffolding
// -------------------------
$body-bg: ${theme.colors.bodyBg};
$page-bg: ${theme.colors.pageBg};

$body-color: ${theme.colors.body};
$text-color: ${theme.colors.text};
$text-color-strong: ${theme.colors.textStrong};
$text-color-weak: ${theme.colors.textWeak};
$text-color-faint: ${theme.colors.textFaint};
$text-color-emphasis: ${theme.colors.textEmphasis};

$text-shadow-faint: 1px 1px 4px rgb(45, 45, 45);
$textShadow: none;

// gradients
$brand-gradient-horizontal: linear-gradient(to right, #f05a28 30%, #fbca0a 99%);
$brand-gradient-vertical: linear-gradient(#f05a28 30%, #fbca0a 99%);
$page-gradient: linear-gradient(180deg, $dark-5 10px, $dark-2 100px);
$edit-gradient: linear-gradient(180deg, $dark-2 50%, $input-black);

// Links
// -------------------------
$link-color: ${theme.colors.link};
$link-color-disabled: ${theme.colors.linkDisabled};
$link-hover-color: ${theme.colors.linkHover};
$external-link-color: ${theme.colors.linkExternal};

// Typography
// -------------------------
$headings-color: ${theme.colors.headingColor};
$abbr-border-color: $gray-2 !default;
$text-muted: $text-color-weak;

$hr-border-color: $dark-9;

// Panel
// -------------------------
$panel-bg: ${theme.colors.panelBg};
$panel-border: solid 1px $dark-1;
$panel-header-hover-bg: $dark-9;
$panel-corner: $panel-bg;

// page header
$page-header-bg: linear-gradient(90deg, $dark-7, $black);
$page-header-shadow: inset 0px -4px 14px $dark-3;
$page-header-border-color: $dark-9;

$divider-border-color: $gray-1;

// Graphite Target Editor
$tight-form-func-bg: $dark-9;
$tight-form-func-highlight-bg: $dark-10;

$modal-backdrop-bg: #353c42;
$code-tag-bg: $dark-1;
$code-tag-border: $dark-9;

// cards
$card-background: linear-gradient(135deg, $dark-8, $dark-6);
$card-background-hover: linear-gradient(135deg, $dark-9, $dark-6);
$card-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);

// Lists
$list-item-bg: $card-background;
$list-item-hover-bg: $card-background-hover;
$list-item-link-color: $text-color;
$list-item-shadow: $card-shadow;

$empty-list-cta-bg: $gray-blue;

// Scrollbars
$scrollbarBackground: #404357;
$scrollbarBackground2: $dark-10;
$scrollbarBorder: black;

// Tables
// -------------------------
$table-bg-accent: $dark-6; // for striping
$table-border: $dark-6; // table and cell border

$table-bg-odd: $dark-3;
$table-bg-hover: $dark-6;

// Buttons
// -------------------------
$btn-secondary-bg: $blue-base;
$btn-secondary-bg-hl: $blue-shade;

$btn-primary-bg: $green-base;
$btn-primary-bg-hl: $green-shade;

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

$input-color: $gray-4;
$input-border-color: $dark-6;
$input-box-shadow: inset 1px 0px 4px 0px rgba(150, 150, 150, 0.1);
$input-border-focus: $dark-6 !default;
$input-box-shadow-focus: $blue-light !default;
$input-color-placeholder: $gray-1 !default;
$input-label-bg: $gray-blue;
$input-label-border-color: $dark-6;
$input-color-select-arrow: $white;

// Input placeholder text color
$placeholderText: darken($text-color, 25%);

// Search
$search-shadow: 0 0 30px 0 $black;
$search-filter-box-bg: $gray-blue;

// Typeahead
$typeahead-shadow: 0 5px 10px 0 $black;
$typeahead-selected-bg: $dark-9;
$typeahead-selected-color: $yellow;

// Dropdowns
// -------------------------
$dropdownBackground: $dark-6;
$dropdownBorder: rgba(0, 0, 0, 0.2);
$dropdownDividerTop: transparent;
$dropdownDividerBottom: #444;

$dropdownLinkColor: $text-color;
$dropdownLinkColorHover: $white;
$dropdownLinkColorActive: $white;

$dropdownLinkBackgroundHover: $dark-9;

// Horizontal forms & lists
// -------------------------
$horizontalComponentOffset: 180px;

// Navbar
// -------------------------
$navbarHeight: 55px;

$navbarBackground: $panel-bg;
$navbarBorder: 1px solid $dark-6;

$navbarButtonBackground: $navbarBackground;
$navbarButtonBackgroundHighlight: $body-bg;

$navbar-button-border: #2f2f32;

// Sidemenu
// -------------------------
$side-menu-bg: $black;
$side-menu-bg-mobile: $side-menu-bg;
$side-menu-item-hover-bg: $dark-3;
$side-menu-shadow: 0 0 20px black;
$side-menu-link-color: $link-color;

// Menu dropdowns
// -------------------------
$menu-dropdown-bg: $body-bg;
$menu-dropdown-hover-bg: $dark-3;
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

// popover
$popover-bg: $dark-2;
$popover-color: $text-color;
$popover-border-color: $dark-9;
$popover-header-bg: $dark-9;
$popover-shadow: 0 0 20px black;

$popover-help-bg: $btn-secondary-bg;
$popover-help-color: $gray-6;

$popover-error-bg: $btn-danger-bg;

// Tooltips and popovers
// -------------------------
$tooltipColor: $popover-help-color;
$tooltipArrowWidth: 5px;
$tooltipLinkColor: $link-color;
$graph-tooltip-bg: $dark-1;

$tooltipBackground: $black;
$tooltipColor: $gray-4;
$tooltipArrowColor: $tooltipBackground;
$tooltipBackgroundError: $brand-danger;

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
$switch-slider-on-bg: linear-gradient(90deg, #eb7b18, #d44a3a);
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
$panel-options-group-header-bg: $gray-blue;

$panel-grid-placeholder-bg: $blue-faint;
$panel-grid-placeholder-shadow: 0 0 4px $blue-shade;

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
