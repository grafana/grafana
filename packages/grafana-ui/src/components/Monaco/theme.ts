import { GrafanaTheme2 } from '@grafana/data';
import { Monaco } from './types';

export default function defineThemes(monaco: Monaco, theme: GrafanaTheme2) {
  const colors = {
    'editor.background': theme.components.input.background,
    'minimap.background': theme.colors.background.secondary,
  };

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
