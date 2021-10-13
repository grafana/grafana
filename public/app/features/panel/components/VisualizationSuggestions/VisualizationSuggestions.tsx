import React from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { VisualizationPreview } from './VisualizationPreview';
import { useStyles2 } from '@grafana/ui';
import { css } from '@emotion/css';
import { useAsync } from 'react-use';
import { importPanelPlugin } from 'app/features/plugins/importPanelPlugin';

export interface Props {
  data: PanelData;
}

export function VisualizationSuggestions({ data }: Props) {
  const { value: suggestions } = useAsync(() => getSuggestions(data), [data]);
  const styles = useStyles2(getStyles);

  return (
    <div>
      <div className={styles.heading}>Suggestions</div>
      <div className={styles.grid}>
        {suggestions &&
          suggestions.map((suggestion, index) => (
            <VisualizationPreview key={index} data={data} suggestion={suggestion} />
          ))}
      </div>
      <div className={styles.heading}>All</div>
    </div>
  );
}

async function getSuggestions(data: PanelData): Promise<VisualizationSuggestion[]> {
  const plugins = ['timeseries', 'barchart', 'gauge', 'piechart', 'bargauge', 'table'];
  const input = { data };
  const allSuggestions: VisualizationSuggestion[] = [];

  for (const pluginId of plugins) {
    const plugin = await importPanelPlugin(pluginId);
    const supplier = plugin.getSuggestionsSupplier();

    if (supplier) {
      const pluginSuggestions = supplier(input);

      if (pluginSuggestions && pluginSuggestions.length > 0) {
        allSuggestions.push(...pluginSuggestions);
      }
    }
  }

  return allSuggestions;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    heading: css({
      ...theme.typography.h5,
      margin: theme.spacing(1),
    }),
    grid: css({
      display: 'flex',
      flexWrap: 'wrap',
    }),
  };
};
