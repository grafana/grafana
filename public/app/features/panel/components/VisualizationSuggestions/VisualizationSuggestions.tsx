import React from 'react';
import { GrafanaTheme2, PanelData, VisualizationSuggestion } from '@grafana/data';
import { VisualizationPreview } from './VisualizationPreview';

export interface Props {
  data: PanelData;
}

export function VisualizationSuggestions({ data }: Props) {
  const suggestions = getSuggestions();

  return (
    <div>
      <div>Suggestions</div>
      <div>
        {suggestions.map((suggestion, index) => (
          <VisualizationPreview key={index} data={data} suggestion={suggestion} />
        ))}
      </div>
    </div>
  );
}

function getSuggestions(): VisualizationSuggestion[] {
  return [
    {
      name: 'Piechart',
      pluginId: 'piechart',
    },
    {
      name: 'Barchart',
      pluginId: 'barchart',
    },
  ];
}

const getStyles = (theme: GrafanaTheme2) => {
  return {};
};
