import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes/stylesFactory';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    menu: css({
      label: 'grafana-select-menu',
      background: theme.components.dropdown.background,
      boxShadow: theme.shadows.z3,
      position: 'relative',
      minWidth: '100%',
      zIndex: 1,
    }),
    option: css({
      label: 'grafana-select-option',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      flexDirection: 'row',
      flexShrink: 0,
      whiteSpace: 'nowrap',
      cursor: 'pointer',
      borderLeft: '2px solid transparent',

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
      width: '45px', //LOGZ.IO GRAFANA CHANGE :: DEV-19985: add datasource logos
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
      flexWrap: 'nowrap',
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
  };
});
