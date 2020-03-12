import { stylesFactory } from '../../../themes/stylesFactory';
import { selectThemeVariant as stv } from '../../../themes/selectThemeVariant';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

export const getSelectStyles = stylesFactory((theme: GrafanaTheme) => {
  const bgColor = stv({ light: theme.colors.white, dark: theme.colors.gray15 }, theme.type);
  const menuShadowColor = stv({ light: theme.colors.gray4, dark: theme.colors.black }, theme.type);
  const optionBgHover = stv({ light: theme.colors.gray7, dark: theme.colors.gray10 }, theme.type);
  const multiValueContainerBg = stv({ light: theme.colors.gray6, dark: theme.colors.gray05 }, theme.type);
  const multiValueColor = stv({ light: theme.colors.gray25, dark: theme.colors.gray85 }, theme.type);

  return {
    menu: css`
      background: ${bgColor};
      box-shadow: 0px 4px 4px ${menuShadowColor};
      position: relative;
      min-width: 100%;
      z-index: 1;
    `,
    option: css`
      padding: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-direction: row;
      white-space: nowrap;
      cursor: pointer;
      border-left: 2px solid transparent;
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
      position: relative;
      box-sizing: border-box;
      flex: 1 1 0%;
      outline: none;
      overflow: hidden;
    `,
    valueContainerMulti: css`
      flex-wrap: wrap;
    `,
    loadingMessage: css`
      padding: ${theme.spacing.sm};
      text-align: center;
      width: 100%;
    `,
    multiValueContainer: css`
      display: flex;
      align-items: center;
      line-height: 1;
      background: ${multiValueContainerBg};
      border-radius: ${theme.border.radius.sm};
      padding: ${theme.spacing.xs} ${theme.spacing.xxs} ${theme.spacing.xs} ${theme.spacing.sm};
      margin: ${theme.spacing.xxs} ${theme.spacing.xs} ${theme.spacing.xxs} 0;
      color: ${multiValueColor};
    `,
    multiValueRemove: css`
      margin-left: ${theme.spacing.xs};
    `,
  };
});
