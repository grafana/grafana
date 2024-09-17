import tinycolor from 'tinycolor2';

import { GrafanaTheme2 } from '@grafana/data';

import { Monaco, monacoTypes } from './types';

function getColors(theme?: GrafanaTheme2): monacoTypes.editor.IColors {
  if (theme === undefined) {
    return {};
  } else {
    const colors: Record<string, string> = {
      'editor.background': theme.components.input.background,
      'minimap.background': theme.colors.background.secondary,
    };

    Object.keys(colors).forEach((resultKey) => {
      colors[resultKey] = normalizeColorForMonaco(colors[resultKey]);
    });
    return colors;
  }
}

function normalizeColorForMonaco(color?: string): string {
  // monaco needs 6char hex colors
  // see https://github.com/grafana/grafana/issues/43158
  return tinycolor(color).toHexString();
}

// we support calling this without a theme, it will make sure the themes
// are registered in monaco, even if the colors are not perfect.
export default function defineThemes(monaco: Monaco, theme?: GrafanaTheme2) {
  // color tokens are defined here https://github.com/microsoft/vscode/blob/main/src/vs/platform/theme/common/colorRegistry.ts#L174
  const colors = getColors(theme);
  monaco.editor.defineTheme('grafana-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: colors,
    // fallback syntax highlighting for languages that microsoft doesn't handle (ex cloudwatch's metric math)
    rules: [
      { token: 'predefined', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('purple')) },
      { token: 'operator', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('orange')) },
      { token: 'tag', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('green')) },
    ],
  });

  monaco.editor.defineTheme('grafana-light', {
    base: 'vs',
    inherit: true,
    colors: colors,
    // fallback syntax highlighting for languages that microsoft doesn't handle (ex cloudwatch's metric math)
    rules: [
      { token: 'predefined', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('purple')) },
      { token: 'operator', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('orange')) },
      { token: 'tag', foreground: normalizeColorForMonaco(theme?.visualization.getColorByName('green')) },
    ],
  });
}
