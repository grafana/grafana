import { css } from '@emotion/css';
import React from 'react';

import { SelectableValue } from '@grafana/data';
import { RadioButtonGroup } from '@grafana/ui';

import { EXPLORE_GRAPH_STYLES, ExploreGraphStyle } from '../../types';

const ALL_GRAPH_STYLE_OPTIONS: Array<SelectableValue<ExploreGraphStyle>> = EXPLORE_GRAPH_STYLES.map((style) => ({
  value: style,
  // capital-case it and switch `_` to ` `
  label: style[0].toUpperCase() + style.slice(1).replace(/_/, ' '),
}));

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
