import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';

import { stylesFactory } from '../../themes/stylesFactory';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme2) => {
  return {
    menu: css`
      label: grafana-select-menu;
      background: ${theme.components.dropdown.background};
      box-shadow: ${theme.shadows.z3};
      position: relative;
      min-width: 100%;
      z-index: 1;
    `,
    option: css`
      label: grafana-select-option;
      padding: 8px;
      display: flex;
      align-items: center;
      flex-direction: row;
      flex-shrink: 0;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;

      &:hover {
        background: ${theme.colors.action.hover};
      }
    `,
    optionIcon: css`
      margin-right: ${theme.spacing(1)};
    `,
    optionImage: css`
      label: grafana-select-option-image;
      width: 16px;
      margin-right: 10px;
    `,
    optionDescription: css`
      label: grafana-select-option-description;
      font-weight: normal;
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
      white-space: normal;
      line-height: ${theme.typography.body.lineHeight};
    `,
    optionBody: css`
      label: grafana-select-option-body;
      display: flex;
      font-weight: ${theme.typography.fontWeightMedium};
      flex-direction: column;
      flex-grow: 1;
    `,
    optionFocused: css`
      label: grafana-select-option-focused;
      background: ${theme.colors.action.focus};
    `,
    optionSelected: css`
      background: ${theme.colors.action.selected};
    `,
    optionDisabled: css`
      label: grafana-select-option-disabled;
      background-color: ${theme.colors.action.disabledBackground};
      color: ${theme.colors.action.disabledText};
      cursor: not-allowed;
    `,
    singleValue: css`
      label: grafana-select-single-value;
      color: ${theme.components.input.text};
      grid-area: 1 / 1 / 2 / 3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      max-width: 100%;
    `,
    valueContainer: css`
      label: grafana-select-value-container;
      align-items: center;
      display: grid;
      position: relative;
      box-sizing: border-box;
      flex: 1 1 0%;
      outline: none;
      overflow: hidden;
    `,
    valueContainerMulti: css`
      label: grafana-select-value-container-multi;
      flex-wrap: wrap;
      display: flex;
    `,
    loadingMessage: css`
      label: grafana-select-loading-message;
      padding: ${theme.spacing(1)};
      text-align: center;
      width: 100%;
    `,
    multiValueContainer: css`
      label: grafana-select-multi-value-container;
      display: flex;
      align-items: center;
      line-height: 1;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.borderRadius()};
      margin: ${theme.spacing(0.25, 1, 0.25, 0)};
      padding: ${theme.spacing(0.25, 0, 0.25, 1)};
      color: ${theme.colors.text.primary};
      font-size: ${theme.typography.size.sm};

      &:hover {
        background: ${theme.colors.emphasize(theme.colors.background.secondary)};
      }
    `,
    multiValueRemove: css`
      label: grafana-select-multi-value-remove;
      margin: ${theme.spacing(0, 0.5)};
      cursor: pointer;
      svg {
        margin-bottom: 0;
      }
    `,
    singleValueRemove: css`
      cursor: pointer;
      &:hover {
        color: ${theme.colors.text.primary};
      }
    `,
  };
});
