import React from 'react';
import { PanelData, VisualizationSuggestion } from '@grafana/data';
import { PanelRenderer } from '../PanelRenderer';

export interface Props {
  data: PanelData;
  suggestion: VisualizationSuggestion;
}

export function VisualizationPreview({ data, suggestion }: Props) {
  const width = 300;
  const height = 300;

  return (
    <div>
      <div style={{ width, height }}>
        <PanelRenderer title="" data={data} pluginId={suggestion.pluginId} width={width} height={height} />
      </div>
    </div>
  );
}
