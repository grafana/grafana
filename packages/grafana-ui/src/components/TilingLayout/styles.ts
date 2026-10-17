import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { type LayoutMetrics } from './model/types';

export const TAB_BAR_HEIGHT = 32;

export function getMetrics(theme: GrafanaTheme2): LayoutMetrics {
  return {
    gap: theme.spacing.gridSize * 0.75,
    tabBarHeight: TAB_BAR_HEIGHT,
    minPanelWidth: 80,
    minPanelHeight: TAB_BAR_HEIGHT + 24,
  };
}

/** Durations from the interaction model. */
export const MOTION = {
  settle: 150,
  layout: 180,
  camera: 300,
  lift: 280,
};

export const getStyles = (theme: GrafanaTheme2) => {
  const layoutTransition = ['left', 'top', 'width', 'height']
    .map((p) => `${p} var(--tiling-duration, ${MOTION.layout}ms) cubic-bezier(.2, .75, .2, 1)`)
    .join(', ');
  // Transitions only apply when the user hasn't asked for reduced motion.
  const motion = (transition: string) => ({ [theme.transitions.handleMotion('no-preference')]: { transition } });

  return {
    root: css({
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      background: theme.colors.background.canvas,
      isolation: 'isolate',
      '&[data-dragging]': {
        userSelect: 'none',
        cursor: 'grabbing',
      },
      '&[data-resizing] *': {
        ...motion('none !important'),
      },
    }),
    frame: css({
      position: 'absolute',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
      ...motion(layoutTransition),
      '&[data-floating]': {
        boxShadow: theme.shadows.z3,
        borderColor: theme.colors.border.medium,
      },
      '&[data-lifted]': {
        boxShadow: theme.shadows.z3,
        ...motion('none'),
        pointerEvents: 'none',
      },
    }),
    frameBody: css({
      flex: 1,
      minHeight: 0,
    }),
    tabBar: css({
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      gap: theme.spacing(0.5),
      padding: theme.spacing(0, 0.5),
      background: theme.colors.background.secondary,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      cursor: 'default',
      touchAction: 'none',
    }),
    tabStrip: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.25),
      minWidth: 0,
      flex: 1,
      height: '100%',
      overflowX: 'auto',
      overflowY: 'hidden',
      scrollbarWidth: 'none',
      '&::-webkit-scrollbar': {
        display: 'none',
      },
    }),
    tab: css({
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      flexShrink: 0,
      gap: theme.spacing(0.5),
      height: TAB_BAR_HEIGHT - 8,
      maxWidth: 220,
      padding: theme.spacing(0, 1),
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      whiteSpace: 'nowrap',
      userSelect: 'none',
      outline: 'none',
      ...motion(`transform ${MOTION.layout}ms cubic-bezier(.2, .75, .2, 1), background-color 100ms`),
      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
      '&[aria-selected="true"]': {
        background: theme.colors.background.primary,
        color: theme.colors.text.primary,
        boxShadow: theme.shadows.z1,
      },
      '&[data-focused]::before': {
        content: '""',
        position: 'absolute',
        left: 4,
        right: 4,
        top: 0,
        height: 2,
        borderRadius: theme.shape.radius.sm,
        background: theme.colors.primary.main,
      },
      '&:focus-visible': {
        boxShadow: `0 0 0 2px ${theme.colors.primary.main}`,
      },
      '&[data-dragging]': {
        zIndex: 2,
        ...motion('none'),
        background: theme.colors.background.primary,
        boxShadow: theme.shadows.z2,
      },
    }),
    tabTitle: css({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }),
    tabClose: css({
      margin: 0,
      opacity: 0,
      '[aria-selected="true"] > &, [role="tab"]:hover > &, &:focus-visible': {
        opacity: 1,
      },
    }),
    tabBarActions: css({
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      gap: theme.spacing(0.5),
      '& button': {
        margin: 0,
      },
    }),
    surface: css({
      position: 'absolute',
      overflow: 'hidden',
      borderRadius: `0 0 ${theme.shape.radius.default} ${theme.shape.radius.default}`,
      boxSizing: 'border-box',
      ...motion(layoutTransition),
      '&[data-lifted]': {
        ...motion('none'),
      },
      '&[data-inert]': {
        pointerEvents: 'none',
      },
    }),
    surfaceContent: css({
      width: '100%',
      height: '100%',
      overflow: 'auto',
    }),
    slot: css({
      position: 'absolute',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxSizing: 'border-box',
      borderRadius: theme.shape.radius.default,
      background: theme.colors.primary.transparent,
      border: `1px solid ${theme.colors.primary.border}`,
      color: theme.colors.primary.text,
      fontSize: theme.typography.bodySmall.fontSize,
      pointerEvents: 'none',
      ...motion(layoutTransition),
      '&[data-kind="tab"]': {
        background: theme.colors.primary.transparent,
        opacity: 0.85,
      },
    }),
    sourceSlot: css({
      position: 'absolute',
      boxSizing: 'border-box',
      borderRadius: theme.shape.radius.default,
      border: `1px dashed ${theme.colors.border.medium}`,
      pointerEvents: 'none',
    }),
    divider: css({
      position: 'absolute',
      zIndex: 50,
      touchAction: 'none',
      outline: 'none',
      '&::after': {
        content: '""',
        position: 'absolute',
        borderRadius: theme.shape.radius.sm,
        background: 'transparent',
        ...motion('background-color 150ms'),
      },
      '&[aria-orientation="vertical"]': {
        cursor: 'col-resize',
        '&::after': { top: 0, bottom: 0, left: '50%', width: 2, marginLeft: -1 },
      },
      '&[aria-orientation="horizontal"]': {
        cursor: 'row-resize',
        '&::after': { left: 0, right: 0, top: '50%', height: 2, marginTop: -1 },
      },
      '&:hover::after, &:focus-visible::after, &[data-active]::after': {
        background: theme.colors.primary.main,
      },
    }),
    resizeLayer: css({
      position: 'absolute',
      pointerEvents: 'none',
      ...motion(layoutTransition),
    }),
    resizeHandle: css({
      position: 'absolute',
      pointerEvents: 'auto',
      touchAction: 'none',
    }),
    chrome: css({
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      '& > *': {
        pointerEvents: 'auto',
      },
    }),
    empty: css({
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.colors.text.secondary,
    }),
    srOnly: css({
      position: 'absolute',
      width: 1,
      height: 1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap',
    }),
  };
};

export type TilingStyles = ReturnType<typeof getStyles>;
