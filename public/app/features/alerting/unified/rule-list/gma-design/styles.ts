import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

// Brand gradient used by the design for active tab underlines.
const BRAND_GRADIENT = 'linear-gradient(270deg, #F55F3E 0%, #FF8833 100%)';

/**
 * Styles ported from the "Alert rules v3" design prototype (list-v3).
 * Design tokens are mapped onto the Grafana theme so the view matches the
 * surrounding product in both light and dark.
 */
export const getRuleDesignStyles = (theme: GrafanaTheme2) => ({
  // ---- Folder card (header mirrors ListSection's sectionTitle) ----
  folder: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  folderHead: css({
    padding: theme.spacing(1, 1.5),
    '&:hover': {
      background: theme.colors.action.hover,
      borderRadius: theme.shape.radius.default,
    },
  }),
  frules: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
  }),
  frulesSep: css({
    margin: theme.spacing(0, 0.75),
    color: theme.colors.text.disabled,
  }),
  recCount: css({
    color: theme.colors.text.disabled,
  }),
  // Rules container reuses ListSection's folder guide line + indentation so rows
  // line up with the old grouped view.
  rulesContainer: css({
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(4),
    '&:before': {
      content: "''",
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: theme.spacing(2.5),
      borderLeft: `solid 1px ${theme.colors.border.weak}`,
    },
  }),

  // ---- Rule row ----
  rule: css({
    display: 'grid',
    gridTemplateColumns: '16px 1fr auto',
    gap: theme.spacing(1.25),
    alignItems: 'start',
    padding: theme.spacing(1),
    borderRadius: theme.shape.radius.default,
    '&:hover': {
      background: theme.colors.action.hover,
    },
  }),
  ruleCompact: css({
    padding: theme.spacing(0.5, 1),
  }),
  ruleDim: css({
    opacity: 0.7,
    '&:hover': {
      opacity: 1,
    },
  }),
  stateGlyph: css({
    width: 16,
    height: 16,
    marginTop: 2,
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  // Neutral placeholder — k8s API exposes no alert state.
  statePlaceholder: css({
    width: 10,
    height: 10,
    margin: '3px 3px 0',
    borderRadius: theme.shape.radius.circle,
    border: `2px solid ${theme.colors.text.disabled}`,
    flexShrink: 0,
    boxSizing: 'border-box',
  }),
  recGlyph: css({
    width: 16,
    height: 16,
    marginTop: 2,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.text.disabled,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: 12,
    fontWeight: 500,
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    minWidth: 0,
  }),
  bodyCompact: css({
    gap: 1,
  }),
  nameRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexWrap: 'wrap',
  }),
  name: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    '&:hover': {
      color: theme.colors.text.link,
      textDecoration: 'underline',
    },
  }),
  nameDim: css({
    color: theme.colors.text.secondary,
  }),
  desc: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    lineHeight: 1.4,
  }),
  meta: css({
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 0,
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    marginTop: 2,
    '& > * + *::before': {
      content: '"·"',
      margin: theme.spacing(0, 1),
      color: theme.colors.text.disabled,
    },
  }),
  ds: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
  }),
  dsLogo: css({
    width: 12,
    height: 12,
  }),
  swatch: css({
    width: 10,
    height: 10,
    borderRadius: theme.shape.radius.default,
  }),
  actionsRight: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  evalAlways: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),

  // ---- Badges ----
  badgeProvisioned: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 500,
    borderRadius: theme.shape.radius.default,
    background: 'rgba(184, 119, 217, 0.12)',
    color: '#C998E5',
    border: '1px solid rgba(184, 119, 217, 0.35)',
    letterSpacing: '0.02em',
  }),
  badgeRecording: css({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 500,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.action.selected,
    color: theme.colors.text.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    fontFamily: theme.typography.fontFamilyMonospace,
  }),

  // ---- Folder tabs (nested-tabs treatment) ----
  folderTabs: css({
    display: 'flex',
    gap: 0,
    margin: theme.spacing(0, 0, 0, 4.5),
    paddingBottom: theme.spacing(0.5),
    borderBottom: `1px solid ${theme.colors.border.weak}`,
  }),
  folderTab: css({
    position: 'relative',
    background: 'transparent',
    border: 0,
    color: theme.colors.text.secondary,
    fontFamily: 'inherit',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.75, 1.5, 1),
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  folderTabOn: css({
    color: theme.colors.text.primary,
    '&::after': {
      content: '""',
      position: 'absolute',
      left: theme.spacing(1),
      right: theme.spacing(1),
      bottom: -1,
      height: 2,
      background: BRAND_GRADIENT,
      borderRadius: `${theme.shape.radius.default} ${theme.shape.radius.default} 0 0`,
    },
  }),
  tabCount: css({
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
    fontSize: 11,
  }),

  // ---- Header tabs (header-tabs treatment) ----
  headerTabs: css({
    display: 'inline-flex',
    gap: 0,
    marginLeft: theme.spacing(0.5),
    padding: 2,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    alignSelf: 'center',
  }),
  headerTab: css({
    background: 'transparent',
    border: 0,
    color: theme.colors.text.secondary,
    fontFamily: 'inherit',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: '3px 10px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    borderRadius: theme.shape.radius.default,
    lineHeight: 1.3,
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  headerTabOn: css({
    background: theme.colors.action.selected,
    color: theme.colors.text.primary,
  }),

  // ---- Inline divider (inline-divider treatment) ----
  inlineDivider: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    padding: theme.spacing(1),
    cursor: 'pointer',
    color: theme.colors.text.secondary,
    fontSize: 11,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginTop: theme.spacing(0.5),
    width: '100%',
    background: 'transparent',
    border: 0,
    fontFamily: 'inherit',
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  inlineDividerCount: css({
    color: theme.colors.text.disabled,
    background: theme.colors.action.selected,
    padding: '1px 8px',
    borderRadius: theme.shape.radius.pill,
    fontSize: 11,
    textTransform: 'none',
    letterSpacing: 0,
    fontWeight: 400,
    fontVariantNumeric: 'tabular-nums',
  }),
  inlineDividerHairline: css({
    flex: 1,
    height: 1,
    background: theme.colors.border.weak,
    marginLeft: theme.spacing(0.5),
  }),

  // ---- Folder-bottom recording chip (folder-chip treatment) ----
  chipBar: css({
    padding: theme.spacing(0.75, 1, 1, 4.5),
  }),
  recChip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontFamily: 'inherit',
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    background: 'transparent',
    border: `1px dashed ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.pill,
    padding: theme.spacing(0.5, 1.5),
    cursor: 'pointer',
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
      borderColor: theme.colors.border.strong,
      borderStyle: 'solid',
    },
  }),
  recChipOn: css({
    background: theme.colors.action.selected,
    color: theme.colors.text.primary,
    borderStyle: 'solid',
    borderColor: theme.colors.border.strong,
  }),
  recBlock: css({
    background: 'rgba(255,255,255,0.015)',
    borderLeftColor: theme.colors.border.medium,
  }),

  // ---- Top-level split toggle (tabbed treatment) ----
  splitToggle: css({
    display: 'inline-flex',
    gap: theme.spacing(0.5),
    padding: 2,
    background: theme.colors.background.canvas,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    margin: theme.spacing(1.5, 2, 0.5),
  }),
  splitToggleButton: css({
    background: 'transparent',
    border: 0,
    color: theme.colors.text.secondary,
    fontFamily: 'inherit',
    fontSize: theme.typography.bodySmall.fontSize,
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    '&:hover': {
      color: theme.colors.text.primary,
    },
  }),
  splitToggleButtonOn: css({
    background: theme.colors.action.selected,
    color: theme.colors.text.primary,
  }),

  // ---- Load more ----
  loadMore: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    padding: theme.spacing(1, 0, 0.5),
  }),
  loadMoreMeta: css({
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.disabled,
    fontVariantNumeric: 'tabular-nums',
  }),
});
