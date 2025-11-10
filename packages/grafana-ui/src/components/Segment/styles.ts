import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

export const getSegmentStyles = (theme: GrafanaTheme2) => {
  return {
    segment: css({
      cursor: 'pointer',
      width: 'auto',
    }),

    queryPlaceholder: css({
      color: theme.colors.text.disabled,
    }),

    disabled: css({
      cursor: 'not-allowed',
      opacity: 0.65,
      boxShadow: 'none',
    }),
    input: css({
      display: 'block',
      height: '32px',
      padding: theme.spacing(0, 1),
      fontSize: theme.typography.size.md,
      lineHeight: '18px',
      color: theme.components.input.text,
      backgroundColor: theme.components.input.background,
      backgroundImage: 'none',
      backgroundClip: 'padding-box',
      border: `1px solid ${theme.components.input.borderColor}`,
      borderRadius: theme.shape.radius.default,
      marginRight: theme.spacing(0.5),
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left',
      position: 'relative',
      marginBottom: theme.spacing(0.5),
    }),
    addButton: css({
      display: 'flex',
      alignItems: 'center',
      padding: theme.spacing(0, 1),
      flexShrink: 0,
      fontWeight: theme.typography.fontWeightMedium,
      fontSize: theme.typography.size.sm,
      backgroundColor: theme.colors.background.secondary,
      height: '32px',
      lineHeight: '32px',
      marginRight: theme.spacing(0.5),
      borderRadius: theme.shape.radius.default,
      justifyContent: 'space-between',
      border: 'none',
    }),
  };
};
