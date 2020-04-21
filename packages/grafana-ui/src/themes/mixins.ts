import { GrafanaTheme } from '@grafana/data';
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

export function hoverColor(color: string, theme: GrafanaTheme): string {
  return theme.isDark
    ? tinycolor(color)
        .brighten(2)
        .toString()
    : tinycolor(color)
        .darken(2)
        .toString();
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
