/* tslint:disable:max-line-length */

import { GrafanaThemeCommons } from '../types';
import { renderGeneratedFileBanner } from '../utils/generatedFileBanner';

export const commonThemeVarsTemplate = (theme: GrafanaThemeCommons) =>
  `${renderGeneratedFileBanner('grafana-ui/src/themes/default.ts', 'grafana-ui/src/themes/_variables.scss.tmpl.ts')}
// Options
//
// Quickly modify global styling by enabling or disabling optional features.

$enable-flex: true !default;
$enable-hover-media-query: false !default;

// Spacing
//
// Control the default styling of most Bootstrap elements by modifying these
// variables. Mostly focused on spacing.

$space-inset-squish-md: ${theme.spacing.insetSquishMd} !default;

$space-xxs: ${theme.spacing.xxs} !default;
$space-xs: ${theme.spacing.xs} !default;
$space-sm: ${theme.spacing.sm} !default;
$space-md: ${theme.spacing.md} !default;
$space-lg: ${theme.spacing.lg} !default;
$space-xl: ${theme.spacing.xl} !default;

$spacer: ${theme.spacing.d} !default;
$spacer-x: $spacer !default;
$spacer-y: $spacer !default;
$spacers: (
  0: (
    x: 0,
    y: 0,
  ),
  1: (
    x: $spacer-x,
    y: $spacer-y,
  ),
  2: (
    x: (
      $spacer-x * 1.5,
    ),
    y: (
      $spacer-y * 1.5,
    ),
  ),
  3: (
    x: (
      $spacer-x * 3,
    ),
    y: (
      $spacer-y * 3,
    ),
  ),
) !default;

// Grid breakpoints
//
// Define the minimum and maximum dimensions at which your layout will change,
// adapting to different screen sizes, for use in media queries.

$grid-breakpoints: (
  xs: ${theme.breakpoints.xs},
  sm: ${theme.breakpoints.sm},
  md: ${theme.breakpoints.md},
  lg: ${theme.breakpoints.lg},
  xl: ${theme.breakpoints.xl},
) !default;

// Grid containers
//
// Define the maximum width of \`.container\` for different screen sizes.

$container-max-widths: (
  sm: 576px,
  md: 720px,
  lg: 940px,
  xl: 1080px,
) !default;

// Grid columns
//
// Set the number of columns and specify the width of the gutters.

$grid-columns: 12 !default;
$grid-gutter-width: ${theme.spacing.gutter} !default;

// Component heights
// -------------------------
$height-sm: ${theme.height.sm};
$height-md: ${theme.height.md};
$height-lg: ${theme.height.lg};

// Typography
// -------------------------

$font-family-sans-serif: ${theme.typography.fontFamily.sansSerif};
$font-family-monospace: ${theme.typography.fontFamily.monospace};

$font-size-root: ${theme.typography.size.root} !default;
$font-size-base: ${theme.typography.size.base} !default;

$font-size-lg: ${theme.typography.size.lg} !default;
$font-size-md: ${theme.typography.size.md} !default;
$font-size-sm: ${theme.typography.size.sm} !default;
$font-size-xs: ${theme.typography.size.xs} !default;

$line-height-base: ${theme.typography.lineHeight.lg} !default;

$font-weight-regular: ${theme.typography.weight.regular} !default;
$font-weight-semi-bold: ${theme.typography.weight.semibold} !default;

$font-size-h1: ${theme.typography.heading.h1} !default;
$font-size-h2: ${theme.typography.heading.h2} !default;
$font-size-h3: ${theme.typography.heading.h3} !default;
$font-size-h4: ${theme.typography.heading.h4} !default;
$font-size-h5: ${theme.typography.heading.h5} !default;
$font-size-h6: ${theme.typography.heading.h6} !default;

$headings-line-height: ${theme.typography.lineHeight.sm} !default;

// Components
//
// Define common padding and border radius sizes and more.

$border-width: ${theme.border.width.sm} !default;

$border-radius: ${theme.border.radius.md} !default;
$border-radius-lg: ${theme.border.radius.lg} !default;
$border-radius-sm: ${theme.border.radius.sm} !default;

// Page

$page-sidebar-width: 154px;
$page-sidebar-margin: 56px;

// Links
// -------------------------
$link-decoration: ${theme.typography.link.decoration} !default;
$link-hover-decoration: ${theme.typography.link.hoverDecoration} !default;

// Forms
$input-line-height: 18px !default;

$input-border-radius: 0 $border-radius $border-radius 0 !default;
$input-border-radius-sm: 0 $border-radius-sm $border-radius-sm 0 !default;

$label-border-radius: $border-radius 0 0 $border-radius !default;
$label-border-radius-sm: $border-radius-sm 0 0 $border-radius-sm !default;

$input-padding: ${theme.spacing.sm};
$input-height: 35px !default;

$cursor-disabled: not-allowed !default;

// Form validation icons
$form-icon-success: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%235cb85c' d='M2.3 6.73L.6 4.53c-.4-1.04.46-1.4 1.1-.8l1.1 1.4 3.4-3.8c.6-.63 1.6-.27 1.2.7l-4 4.6c-.43.5-.8.4-1.1.1z'/%3E%3C/svg%3E") !default;
$form-icon-warning: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8'%3E%3Cpath fill='%23f0ad4e' d='M4.4 5.324h-.8v-2.46h.8zm0 1.42h-.8V5.89h.8zM3.76.63L.04 7.075c-.115.2.016.425.26.426h7.397c.242 0 .372-.226.258-.426C6.726 4.924 5.47 2.79 4.253.63c-.113-.174-.39-.174-.494 0z'/%3E%3C/svg%3E") !default;
$form-icon-danger: url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='%23d9534f' viewBox='-2 -2 7 7'%3E%3Cpath stroke='%23d9534f' d='M0 0l3 3m0-3L0 3'/%3E%3Ccircle r='.5'/%3E%3Ccircle cx='3' r='.5'/%3E%3Ccircle cy='3' r='.5'/%3E%3Ccircle cx='3' cy='3' r='.5'/%3E%3C/svg%3E") !default;

// Z-index master list
// -------------------------
// Used for a bird's eye view of components dependent on the z-axis
// Try to avoid customizing these :)
$zindex-dropdown: ${theme.zIndex.dropdown};
$zindex-navbar-fixed: ${theme.zIndex.navbarFixed};
$zindex-sidemenu: ${theme.zIndex.sidemenu};
$zindex-tooltip: ${theme.zIndex.tooltip};
$zindex-modal-backdrop: ${theme.zIndex.modalBackdrop};
$zindex-modal: ${theme.zIndex.modal};
$zindex-typeahead: ${theme.zIndex.typeahead};
$zindex-timepicker-popover: 1070;

// Buttons
//

$btn-padding-x: 14px !default;
$btn-padding-y: 10px !default;
$btn-line-height: 1 !default;
$btn-font-weight: ${theme.typography.weight.semibold} !default;

$btn-padding-x-sm: 7px !default;
$btn-padding-y-sm: 4px !default;

$btn-padding-x-lg: 21px !default;
$btn-padding-y-lg: 11px !default;

$btn-padding-x-xl: 21px !default;
$btn-padding-y-xl: 11px !default;

$btn-semi-transparent: rgba(0, 0, 0, 0.2) !default;

// sidemenu
$side-menu-width: 60px;

// dashboard
$dashboard-padding: $space-md;
$panel-padding: 0 ${theme.panelPadding.horizontal}px ${theme.panelPadding.vertical}px ${
    theme.panelPadding.horizontal
  }px;

// tabs
$tabs-padding: 10px 15px 9px;

$external-services: (
  github: (
    bgColor: #464646,
    borderColor: #393939,
    icon: '',
  ),
  gitlab: (
    bgColor: #fc6d26,
    borderColor: #e24329,
    icon: '',
  ),
  google: (
    bgColor: #e84d3c,
    borderColor: #b83e31,
    icon: '',
  ),
  grafanacom: (
    bgColor: #262628,
    borderColor: #393939,
    icon: '',
  ),
  oauth: (
    bgColor: #262628,
    borderColor: #393939,
    icon: '',
  ),
) !default;
`;
