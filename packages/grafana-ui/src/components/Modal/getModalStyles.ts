import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getModalStyles = (theme: GrafanaTheme2) => {
  const borderRadius = theme.shape.radius.default;

  return {
    modal: css({
      zIndex: theme.zIndex.modal,
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius,
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundClip: 'padding-box',
      outline: 'none',

      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',

      width: '100%',
      maxWidth: '750px',

      maxHeight: '100%',

      display: 'flex',
      flexDirection: 'column',
    }),
    modalBackdrop: css({
      position: 'fixed',
      zIndex: theme.zIndex.modalBackdrop,
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: theme.components.overlay.background,
    }),
    modalHeader: css({
      label: 'modalHeader',
      display: 'flex',
      alignItems: 'center',
      minHeight: '42px',
      margin: theme.spacing(1, 1, 0, 1),
      [theme.breakpoints.up('md')]: {
        margin: theme.spacing(1, 2, 0, 2),
      },
    }),
    modalHeaderWithTabs: css({
      borderBottom: `1px solid ${theme.colors.border.weak}`,
    }),
    modalHeaderTitle: css({
      fontSize: theme.typography.size.lg,
      margin: theme.spacing(0, 4, 0, 1),
      display: 'flex',
      alignItems: 'center',
      position: 'relative',
      top: '2px',
    }),
    modalHeaderIcon: css({
      marginRight: theme.spacing(2),
      fontSize: 'inherit',
      '&:before': {
        verticalAlign: 'baseline',
      },
    }),
    modalHeaderClose: css({
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      color: theme.colors.text.secondary,
      flexGrow: 1,
      justifyContent: 'flex-end',
    }),
    modalContent: css({
      overflow: 'auto',
      padding: theme.spacing(1, 2, 2, 2),
      width: '100%',
      [theme.breakpoints.up('md')]: {
        padding: theme.spacing(3),
      },
    }),
    modalButtonRow: css({
      paddingTop: theme.spacing(3),
    }),
  };
};
