import { stylesFactory } from '../../themes/stylesFactory';
import { css } from '@emotion/css';
import { GrafanaTheme } from '@grafana/data';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    menu: css`
      label: grafana-select-menu;
      background: ${theme.v2.palette.layer2};
      box-shadow: ${theme.v2.shadows.z3};
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
        background: ${theme.v2.palette.action.hover};
      }
    `,
    optionImage: css`
      label: grafana-select-option-image;
      width: 16px;
      margin-right: 10px;
    `,
    optionDescription: css`
      label: grafana-select-option-description;
      font-weight: normal;
      font-size: ${theme.v2.typography.size.sm};
      color: ${theme.v2.palette.text.secondary};
      white-space: normal;
      line-height: ${theme.v2.typography.body.lineHeight};
    `,
    optionBody: css`
      label: grafana-select-option-body;
      display: flex;
      font-weight: ${theme.v2.typography.fontWeightMedium};
      flex-direction: column;
      flex-grow: 1;
    `,
    optionFocused: css`
      label: grafana-select-option-focused;
      background: ${theme.v2.palette.action.focus};
    `,
    optionSelected: css`
      background: ${theme.v2.palette.action.selected};
    `,
    singleValue: css`
      label: grafana-select-single-value;
      color: ${theme.v2.components.form.text};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      max-width: 100%;
    `,
    valueContainer: css`
      label: grafana-select-value-container;
      align-items: center;
      display: flex;
      position: relative;
      box-sizing: border-box;
      flex: 1 1 0%;
      outline: none;
      overflow: hidden;
    `,
    valueContainerMulti: css`
      label: grafana-select-value-container-multi;
      flex-wrap: wrap;
    `,
    loadingMessage: css`
      label: grafana-select-loading-message;
      padding: ${theme.v2.spacing(1)};
      text-align: center;
      width: 100%;
    `,
    multiValueContainer: css`
      label: grafana-select-multi-value-container;
      display: flex;
      align-items: center;
      line-height: 1;
      background: ${theme.v2.palette.layer2};
      border-radius: ${theme.v2.shape.borderRadius()};
      margin: ${theme.v2.spacing(0, 1, 0, 0)};
      padding: ${theme.v2.spacing(0.25, 0, 0.25, 1)};
      color: ${theme.v2.palette.text.primary};
      font-size: ${theme.typography.size.sm};
    `,
    multiValueRemove: css`
      label: grafana-select-multi-value-remove;
      margin: ${theme.v2.spacing(0, 0.5)};
      cursor: pointer;
    `,
  };
});
