import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from './selectThemeVariant';
import { css } from 'emotion';
import { stylesFactory } from './stylesFactory';

export function cardChrome(theme: GrafanaTheme): string {
  if (theme.isDark) {
    return `
       background: ${theme.colors.bg2};
       &:hover {
         background: ${theme.colors.bg3};
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);
       border-radius: ${theme.border.radius.md};
    `;
  }

  return `
       background: linear-gradient(135deg, ${theme.palette.gray6}, ${theme.palette.gray7});
       &:hover {
         background: linear-gradient(135deg, ${theme.palette.gray7}, ${theme.palette.gray6});
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.1);
       border-radius: ${theme.border.radius.md};
    `;
}

export function listItem(theme: GrafanaTheme): string {
  if (theme.isDark) {
    return `
       background: ${theme.colors.bg2};
       &:hover {
         background: ${theme.colors.bg3};
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);
       border-radius: ${theme.border.radius.md};
    `;
  }

  return `
       background: ${theme.palette.gray7};
       &:hover {
         background: ${theme.palette.gray6};
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.1);
       border-radius: ${theme.border.radius.md};
    `;
}

export function listItemSelected(theme: GrafanaTheme): string {
  return `
       background: ${theme.isLight ? theme.palette.gray6 : theme.palette.dark9};
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
