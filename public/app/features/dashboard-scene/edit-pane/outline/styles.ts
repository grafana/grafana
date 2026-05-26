import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

export function getCommonStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      flexDirection: 'column',
      borderRadius: theme.shape.radius.default,
      color: theme.colors.text.secondary,
    }),
    containerSelected: css({
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      outlineOffset: '0px',
      color: theme.colors.text.primary,
    }),
    row: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
    }),
    rowEditMode: css({
      '&:hover': {
        color: theme.colors.text.primary,
        outline: `1px dashed ${theme.colors.border.strong}`,
        backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
      },
    }),
    rowViewMode: css({
      '&:hover': {
        textDecoration: 'underline',
      },
    }),
    rowSelected: css({
      color: theme.colors.text.primary,
      outline: `1px dashed ${theme.colors.primary.border} !important`,
      backgroundColor: theme.colors.emphasize(theme.colors.background.primary, 0.05),
    }),
    nodeButton: css({
      boxShadow: 'none',
      border: 'none',
      background: 'transparent',
      padding: 0,
      borderRadius: theme.shape.radius.default,
      color: 'inherit',
      display: 'flex',
      flexGrow: 1,
      alignItems: 'center',
      gap: theme.spacing(0.5),
      overflow: 'hidden',
      '> span': {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }),
    nodeName: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexGrow: 1,
      alignItems: 'center',
      overflow: 'hidden',
    }),
    nodeNameText: css({
      display: 'inline-flex',
      alignItems: 'center',
      overflow: 'hidden',
      minWidth: 0,
    }),
    hiddenIcon: css({
      color: theme.colors.text.secondary,
      marginLeft: theme.spacing(1),
    }),
    nodeButtonClone: css({
      color: theme.colors.text.secondary,
    }),
    outlineInput: css({
      border: `1px solid ${theme.components.input.borderColor}`,
      height: theme.spacing(3),
      borderRadius: theme.shape.radius.default,

      '&:focus': {
        outline: 'none',
        boxShadow: 'none',
      },
    }),
  };
}
