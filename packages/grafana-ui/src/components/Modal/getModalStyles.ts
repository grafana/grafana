import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getModalStyles = (theme: GrafanaTheme2) => {
  return {
    modal: css({
      position: 'fixed',
      zIndex: theme.zIndex.modal,
      background: theme.colors.background.primary,
      boxShadow: theme.shadows.z3,
      borderRadius: theme.shape.radius.lg,
      border: `1px solid ${theme.colors.border.weak}`,
      backgroundClip: 'padding-box',
      outline: 'none',
      width: '750px',
      maxWidth: '100%',
      left: 0,
      right: 0,
      marginLeft: 'auto',
      marginRight: 'auto',
      top: '10%',
      maxHeight: '80%',
      display: 'flex',
      flexDirection: 'column',
      // Centre the modal vertically on smaller height screens
      // this allows us to fill the full height for maximum usability
      ['@media (max-height: 750px)']: {
        maxHeight: '100%',
        top: '50%',
        transform: 'translateY(-50%)',
      },
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
      margin: theme.spacing(1, 2, 0, 2),
      [theme.breakpoints.down('sm')]: {
        margin: theme.spacing(0, 1, 0, 1),
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
      padding: theme.spacing(3, 3, 0, 3),
      marginBottom: theme.spacing(3),
      scrollbarWidth: 'thin',
      width: '100%',

      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1, 2, 0, 2),
        marginBottom: theme.spacing(2),
      },
    }),
    modalButtonRow: css({
      background: theme.colors.background.primary,
      position: 'sticky',
      bottom: 0,
      paddingTop: theme.spacing(2),
      zIndex: 1,
    }),
  };
};
