import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes/stylesFactory';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    menu: css({
      label: 'grafana-select-menu',
      background: theme.components.dropdown.background,
      borderRadius: theme.shape.radius.default,
      boxShadow: theme.shadows.z3,
      position: 'relative',
      minWidth: '100%',
      overflow: 'hidden',
      zIndex: 1,
    }),
    option: css({
      label: 'grafana-select-option',
      padding: '8px',
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderLeft: '2px solid transparent',
      borderRadius: theme.shape.radius.default,

      '&:hover': {
        background: theme.colors.action.hover,
        '@media (forced-colors: active), (prefers-contrast: more)': {
          border: `1px solid ${theme.colors.primary.border}`,
        },
      },
    }),
    optionIcon: css({
      marginRight: theme.spacing(1),
    }),
    optionImage: css({
      label: 'grafana-select-option-image',
      width: '16px',
      marginRight: '10px',
    }),
    optionDescription: css({
      label: 'grafana-select-option-description',
      fontWeight: 'normal',
      fontSize: theme.typography.size.sm,
      color: theme.colors.text.secondary,
      whiteSpace: 'normal',
      lineHeight: theme.typography.body.lineHeight,
    }),
    optionBody: css({
      label: 'grafana-select-option-body',
      display: 'flex',
      fontWeight: theme.typography.fontWeightMedium,
      flexDirection: 'column',
      flexGrow: 1,
    }),
    optionFocused: css({
      label: 'grafana-select-option-focused',
      background: theme.colors.action.focus,
      '@media (forced-colors: active), (prefers-contrast: more)': {
        border: `1px solid ${theme.colors.primary.border}`,
      },
    }),
    optionSelected: css({
      background: theme.colors.action.selected,
      '&::before': {
        backgroundImage: theme.colors.gradients.brandVertical,
        borderRadius: theme.shape.radius.default,
        content: '" "',
        display: 'block',
        height: '100%',
        position: 'absolute',
        transform: 'translateX(-50%)',
        width: theme.spacing(0.5),
        left: 0,
      },
    }),
    optionDisabled: css({
      label: 'grafana-select-option-disabled',
      backgroundColor: theme.colors.action.disabledBackground,
      color: theme.colors.action.disabledText,
      cursor: 'not-allowed',
    }),
    singleValue: css({
      label: 'grafana-select-single-value',
      color: theme.components.input.text,
      gridArea: '1 / 1 / 2 / 3',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      boxSizing: 'border-box',
      maxWidth: '100%',
    }),
    valueContainer: css({
      label: 'grafana-select-value-container',
      alignItems: 'center',
      display: 'grid',
      position: 'relative',
      boxSizing: 'border-box',
      flex: '1 1 0%',
      outline: 'none',
      overflow: 'hidden',
    }),
    valueContainerMulti: css({
      label: 'grafana-select-value-container-multi',
      flexWrap: 'wrap',
      display: 'flex',
    }),
    valueContainerMultiNoWrap: css({
      display: 'grid',
      gridAutoFlow: 'column',
    }),
    loadingMessage: css({
      label: 'grafana-select-loading-message',
      padding: theme.spacing(1),
      textAlign: 'center',
      width: '100%',
    }),
    multiValueContainer: css({
      label: 'grafana-select-multi-value-container',
      display: 'flex',
      alignItems: 'center',
      lineHeight: 1,
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      margin: theme.spacing(0.25, 1, 0.25, 0),
      padding: theme.spacing(0.25, 0, 0.25, 1),
      color: theme.colors.text.primary,
      fontSize: theme.typography.size.sm,
      overflow: 'hidden',
      whiteSpace: 'nowrap',

      '&:hover': {
        background: theme.colors.emphasize(theme.colors.background.secondary),
      },
    }),
    multiValueRemove: css({
      label: 'grafana-select-multi-value-remove',
      margin: theme.spacing(0, 0.5),
      cursor: 'pointer',
      svg: {
        marginBottom: 0,
      },
    }),
    singleValueRemove: css({
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
    groupHeader: css({
      padding: theme.spacing(1, 1, 1, 0.75),
      borderLeft: '2px solid transparent',
    }),
    group: css({
      '&:not(:first-child)': {
        borderTop: `1px solid ${theme.colors.border.weak}`,
      },
      // ensure there's a bottom border if there are options following the group
      ':has(+ [role="option"])': {
        borderBottom: `1px solid ${theme.colors.border.weak}`,
      },
    }),
    toggleAllButton: css({
      width: '100%',
      border: 0,
      padding: 0,
      textAlign: 'left',
    }),
  };
});
