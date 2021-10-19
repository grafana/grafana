import { GrafanaTheme2 } from '@grafana/data';
import { Monaco } from './types';

/**
 * @internal
 * Experimental export
 **/
export function ensureGrafanaMonacoThemes(monaco: Monaco, theme: GrafanaTheme2) {
  // color tokens are defined here https://github.com/microsoft/vscode/blob/main/src/vs/platform/theme/common/colorRegistry.ts#L174
  const colors = {
    'editor.background': theme.components.input.background,
    'minimap.background': theme.colors.background.secondary,
  };

  // we create the themes if they do not exist, or update the themes
  // if they already exist.
  // NOTE: we should optimize this code to only run once,
  // or to only run when the theme-colors change. we should not run this
  // too often, for example, we should not run this on every render.

  monaco.editor.defineTheme('grafana-dark', {
    base: 'vs-dark',
    inherit: true,
    colors: colors,
    rules: [],
  });

  monaco.editor.defineTheme('grafana-light', {
    base: 'vs',
    inherit: true,
    colors: colors,
    rules: [],
  });
}
