import { GrafanaTheme } from '@grafana/data';

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace styleMixins {
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
}
