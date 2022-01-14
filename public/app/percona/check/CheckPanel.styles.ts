import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant, stylesFactory } from '@grafana/ui';

export const getStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant({ light: theme.palette.gray85, dark: theme.palette.dark7 }, theme.type);

  return {
    panel: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    spinner: css`
      display: flex;
      height: 10em;
      align-items: center;
      justify-content: center;
    `,
    tabBar: css`
      height: 42px;
    `,
    tabContent: css`
      height: calc(100% - 42px);
    `,
    empty: css`
      display: flex;
      width: 100%;
      height: 160px;
      justify-content: center;
      align-items: center;
      border: 1px solid ${borderColor};
      white-space: pre-wrap;
    `,
    link: css`
      color: ${theme.colors.linkExternal};
      &:hover {
        color: ${theme.colors.textBlue};
      }
    `,
  };
});
