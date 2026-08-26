import { css, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

const surfaceEnter = keyframes({
  from: { opacity: 0, transform: 'translateY(-2px) scale(0.98)' },
  to: { opacity: 1, transform: 'translateY(0) scale(1)' },
});

const statusPulse = keyframes({
  '0%, 100%': { opacity: 0.55 },
  '50%': { opacity: 1 },
});

const fillIn = keyframes({
  from: { opacity: 0.4, transform: 'translateX(-3px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
});

export function getQueryCoauthoringStyles(theme: GrafanaTheme2) {
  const compactButton = {
    height: theme.spacing(3),
    minHeight: theme.spacing(3),
    paddingInline: theme.spacing(1),
  };

  return {
    container: css({
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      width: `min(${theme.spacing(52.875)}, calc(100vw - ${theme.spacing(2)}))`,
      minHeight: 0,
      padding: theme.spacing(0.5),
      color: theme.colors.text.primary,
      background: theme.colors.background.elevated,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z2,
      overflow: 'hidden',
      transformOrigin: 'top center',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${surfaceEnter} 140ms ${theme.transitions.easing.easeOut}`,
        transition: theme.transitions.create('max-height', {
          duration: theme.transitions.duration.short,
          easing: theme.transitions.easing.easeOut,
        }),
      },
    }),
    header: css({
      display: 'flex',
      flex: '0 0 auto',
      alignItems: 'flex-start',
      gap: theme.spacing(1),
      minHeight: 0,
      minWidth: 0,
      padding: theme.spacing(1),
    }),
    headerContent: css({
      display: 'flex',
      flex: '1 1 auto',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    headerCopy: css({
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      minWidth: 0,
    }),
    close: css({ flex: '0 0 auto' }),
    pulsingStatus: css({
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${statusPulse} 900ms ease-in-out infinite`,
      },
    }),
    promptRow: css({
      display: 'grid',
      flex: '0 0 auto',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      minHeight: theme.spacing(7),
      padding: theme.spacing(1.5),
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
    }),
    promptInput: css({
      height: theme.spacing(4),
      minHeight: theme.spacing(4),
      paddingInline: theme.spacing(1),
      background: 'transparent',
      border: 0,
      boxShadow: 'none',
      resize: 'none',
      '&:focus': { boxShadow: 'none' },
    }),
    promptSubmit: css({
      width: theme.spacing(3.5),
      height: theme.spacing(3.5),
      margin: 0,
      padding: theme.spacing(0.75),
    }),
    clarificationAction: css({
      display: 'flex',
      flex: '0 0 auto',
      justifyContent: 'flex-end',
      paddingInline: theme.spacing(1),
    }),
    status: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    body: css({
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      minHeight: 0,
      padding: theme.spacing(0, 1.5, 1),
      overflowY: 'auto',
      scrollbarGutter: 'stable',
    }),
    scrollBody: css({
      display: 'flex',
      flex: '1 1 auto',
      flexDirection: 'column',
      gap: theme.spacing(1),
      minHeight: 0,
      overflowY: 'auto',
      scrollbarGutter: 'stable',
    }),
    building: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    }),
    workingFlow: css({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
      padding: theme.spacing(0, 1.5, 1),
    }),
    workingStep: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: theme.spacing(0.5),
      minWidth: 0,
      padding: theme.spacing(0.75, 1),
      border: `1px dashed ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${fillIn} 320ms ${theme.transitions.easing.easeOut} both`,
      },
      code: {
        minWidth: 0,
        overflow: 'hidden',
        color: theme.colors.text.secondary,
        fontFamily: theme.typography.fontFamilyMonospace,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    workingStepDelayed: css({
      [theme.transitions.handleMotion('no-preference')]: { animationDelay: '180ms' },
    }),
    flowArrow: css({ color: theme.colors.text.disabled }),
    proposal: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      minHeight: 0,
      overflow: 'hidden',
    }),
    proposalBody: css({
      display: 'flex',
      flex: '0 0 auto',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      minHeight: 0,
      padding: theme.spacing(0, 1.5, 1),
    }),
    changes: css({
      display: 'flex',
      flex: '0 0 auto',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0, 1.5),
    }),
    changePair: css({
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
      alignItems: 'center',
      gap: theme.spacing(1),
      minWidth: 0,
    }),
    change: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      minWidth: 0,
      padding: theme.spacing(0.75, 1),
      border: `1px dashed ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      code: {
        overflow: 'hidden',
        fontFamily: theme.typography.fontFamilyMonospace,
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
    }),
    proposedChange: css({
      background: theme.colors.info.transparent,
      borderColor: theme.colors.info.border,
    }),
    footer: css({
      display: 'flex',
      flex: '0 0 auto',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      minHeight: theme.spacing(6.5),
      padding: theme.spacing(1.5),
      background: theme.colors.background.primary,
      borderRadius: theme.shape.radius.default,
    }),
    footerActions: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: theme.spacing(0.5),
      minWidth: 0,
    }),
    compactButton: css(compactButton),
    iteration: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      paddingTop: theme.spacing(1),
    }),
    iterationCopy: css({ padding: theme.spacing(1, 1.5) }),
    handoff: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
      padding: theme.spacing(1, 1.5, 0),
    }),
  };
}
