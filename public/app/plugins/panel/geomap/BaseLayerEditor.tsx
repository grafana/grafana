import React, { FC, useMemo } from 'react';
import { css, cx } from '@emotion/css';
import { Select } from '@grafana/ui';
import { GrafanaTheme, StandardEditorProps, MapLayerConfig } from '@grafana/data';
import { GeomapPanelOptions } from './types';
import { geomapLayerRegistry } from './layers/registry';
import { defaultGrafanaThemedMap } from './layers/basemaps/theme';

export const BaseLayerEditor: FC<StandardEditorProps<MapLayerConfig, any, GeomapPanelOptions>> = ({
  value,
  onChange,
  context,
}) => {
  // all basemaps
  const opts = geomapLayerRegistry.selectOptions(
    value?.type // the selected value
      ? [value.type] // as an array
      : [defaultGrafanaThemedMap.id],
    (v) => v.isBaseMap
  );

  // const language = useMemo(() => context.options?.mode ?? TextMode.Markdown, [context]);
  // const theme = useTheme();
  // const styles = getStyles(theme);

  // const getSuggestions = (): CodeEditorSuggestionItem[] => {
  //   if (!context.getSuggestions) {
  //     return [];
  //   }
  //   return context.getSuggestions().map((v) => variableSuggestionToCodeEditorSuggestion(v));
  // };

  return (
    <div>
      <Select
        options={opts.options}
        value={opts.current}
        onChange={(v) => {
          console.log('changed!', v);
          onChange({
            type: v.value!, // the map type
          });
        }}
      />
    </div>
  );
};

// const getStyles = stylesFactory((theme: GrafanaTheme) => ({
//   editorBox: css`
//     label: editorBox;
//     border: ${theme.border.width.sm} solid ${theme.colors.border2};
//     border-radius: ${theme.border.radius.sm};
//     margin: ${theme.spacing.xs} 0;
//     width: 100%;
//   `,
// }));
