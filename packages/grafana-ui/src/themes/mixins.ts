import { GrafanaTheme } from '@grafana/data';
import { selectThemeVariant } from './selectThemeVariant';
import { css } from 'emotion';
import { stylesFactory } from './stylesFactory';

export function cardChrome(theme: GrafanaTheme): string {
  if (theme.isDark) {
    return `
       background: linear-gradient(135deg, ${theme.colors.dark8}, ${theme.colors.dark6});
       &:hover {
         background: linear-gradient(135deg, ${theme.colors.dark9}, ${theme.colors.dark6});
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);
       border-radius: ${theme.border.radius.md};
    `;
  }

  return `
       background: linear-gradient(135deg, ${theme.colors.gray6}, ${theme.colors.gray7});
       &:hover {
         background: linear-gradient(135deg, ${theme.colors.gray7}, ${theme.colors.gray6});
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.1);
       border-radius: ${theme.border.radius.md};
    `;
}

export function listItem(theme: GrafanaTheme): string {
  if (theme.isDark) {
    return `
       background: ${theme.colors.dark7};
       &:hover {
         background: ${theme.colors.dark9};
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);
       border-radius: ${theme.border.radius.md};
    `;
  }

  return `
       background: ${theme.colors.gray7};
       &:hover {
         background: ${theme.colors.gray6};
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.1);
       border-radius: ${theme.border.radius.md};
    `;
}

export function listItemSelected(theme: GrafanaTheme): string {
  return `
       background: ${theme.isLight ? theme.colors.gray6 : theme.colors.dark9};
       color: ${theme.colors.textStrong};
    `;
}

export const panelEditorNestedListStyles = stylesFactory((theme: GrafanaTheme) => {
  const borderColor = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.dark9,
    },
    theme.type
  );
  const shadow = selectThemeVariant(
    {
      light: theme.colors.gray85,
      dark: theme.colors.black,
    },
    theme.type
  );
  const headerBg = selectThemeVariant(
    {
      light: theme.colors.white,
      dark: theme.colors.dark1,
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
