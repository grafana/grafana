import React from 'react';
import { css } from '@emotion/css';
import { ExploreGraphStyle, SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<ExploreGraphStyle>> = [
  { label: 'Lines', value: 'lines' },
  { label: 'Bars', value: 'bars' },
  { label: 'Points', value: 'points' },
  { label: 'Stacked lines', value: 'stacked_lines' },
  { label: 'Stacked bars', value: 'stacked_bars' },
];

const spacing = css({
  display: 'flex',
  justifyContent: 'space-between',
});

type Props = {
  graphStyle: ExploreGraphStyle;
  onChangeGraphStyle: (style: ExploreGraphStyle) => void;
};

export function ExploreGraphLabel(props: Props) {
  const { graphStyle, onChangeGraphStyle } = props;
  return (
    <div className={spacing}>
      Graph
      <RadioButtonGroup size="sm" options={ALL_GRAPH_STYLE_OPTIONS} value={graphStyle} onChange={onChangeGraphStyle} />
    </div>
  );
}
