import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from './selectThemeVariant';
import { css } from 'emotion';
import { stylesFactory } from './stylesFactory';
import tinycolor from 'tinycolor2';

export function cardChrome(theme: GrafanaTheme): string {
  return `
       background: ${theme.colors.bg2};
       &:hover {
         background: ${hoverColor(theme.colors.bg2, theme)};
       }
       box-shadow: ${theme.shadows.listItem};
       border-radius: ${theme.border.radius.md};
    `;
}

export function hoverColor(color: string, theme: GrafanaTheme) {
  return theme.isDark ? tinycolor(color).brighten(2) : tinycolor(color).darken(2);
}

export function listItem(theme: GrafanaTheme): string {
  return `
  background: ${theme.colors.bg2};
  &:hover {
    background: ${hoverColor(theme.colors.bg2, theme)};
  }
  box-shadow: ${theme.shadows.listItem};
  border-radius: ${theme.border.radius.md};
`;
}

export function listItemSelected(theme: GrafanaTheme): string {
  return `
       background: ${hoverColor(theme.colors.bg2, theme)};
       color: ${theme.colors.textStrong};
    `;
}

export const panelEditorNestedListStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.palette.gray85,
      dark: theme.palette.dark9,
    },
    theme.type
  );
  const shadow = selectThemeVariant(
    {
      light: theme.palette.gray85,
      dark: theme.palette.black,
    },
    theme.type
  );
  const headerBg = selectThemeVariant(
    {
      light: theme.palette.white,
      dark: theme.palette.dark1,
    },
    theme.type
  );

  return {
    wrapper: css`
      border: 1px dashed ${borderColor};
      margin-bottom: ${theme.spacing.md};
      transition: box-shadow 0.5s cubic-bezier(0.19, 1, 0.22, 1);
      box-shadow: none;
      &:hover {
        box-shadow: 0 0 10px ${shadow};
      }
    `,
    headerWrapper: css`
      background: ${headerBg};
      padding: ${theme.spacing.xs} 0;
    `,

    content: css`
        padding: ${theme.spacing.xs} ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm};
        border-top: 1px dashed ${borderColor};
        > *:last-child {
          margin-bottom: 0;
      `,
    itemContent: css`
      padding: ${theme.spacing.xs} ${theme.spacing.sm} ${theme.spacing.sm} ${theme.spacing.sm};
    `,
  };
});
