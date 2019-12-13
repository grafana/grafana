import { stylesFactory } from '../../../themes/stylesFactory';
import { selectThemeVariant as stv } from '../../../themes/selectThemeVariant';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = stv({ light: theme.colors.white, dark: theme.colors.gray15 }, theme.type);
  const menuShadowColor = stv({ light: theme.colors.gray4, dark: theme.colors.black }, theme.type);
  const optionBgHover = stv({ light: theme.colors.gray7, dark: theme.colors.gray10 }, theme.type);

  return {
    menu: css`
      background: ${bgColor};
      box-shadow: 0px 4px 4px ${menuShadowColor};
      position: absolute;
      min-width: 100%;
    `,
    option: css`
      padding: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-direction: row;
      white-space: nowrap;
      cursor: pointer;
      &:hover {
        background: ${optionBgHover};
      }
    `,
    optionFocused: css`
      background: ${optionBgHover};
      border-image: linear-gradient(#f05a28 30%, #fbca0a 99%);
      border-image-slice: 1;
      border-style: solid;
      border-top: 0;
      border-right: 0;
      border-bottom: 0;
      border-left-width: 2px;
    `,
    singleValue: css`
      color: ${theme.colors.formInputText};
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-sizing: border-box;
      max-width: 100%;
    `,
    valueContainer: css`
      align-items: center;
      display: flex;
      /* flex-wrap: wrap; ONLY WHEN IT"S MULTI*/
      position: relative;
      box-sizing: border-box;
      flex: 1 1 0%;
      outline: none;
      overflow: hidden;
      > * {
        display: inline-block;
      }
    `,
    loadingMessage: css`
      padding: ${theme.spacing.sm};
      text-align: center;
      width: 100%;
    `,
  };
});
