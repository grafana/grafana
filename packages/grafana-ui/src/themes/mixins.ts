import { GrafanaTheme } from '@grafana/data';

export function cardChrome(theme: GrafanaTheme): string {
  if (theme.isDark) {
    return `
       background: linear-gradient(135deg, ${theme.colors.dark8}, ${theme.colors.dark6});
       &:hover {
         background: linear-gradient(135deg, ${theme.colors.dark9}, ${theme.colors.dark6});
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.3);
    `;
  }

  return `
       background: linear-gradient(135deg, ${theme.colors.gray6}, ${theme.colors.gray5});
       &:hover {
         background: linear-gradient(135deg, ${theme.colors.dark5}, ${theme.colors.gray6});
       }
       box-shadow: -1px -1px 0 0 hsla(0, 0%, 100%, 0.1), 1px 1px 0 0 rgba(0, 0, 0, 0.1);
    `;
}
