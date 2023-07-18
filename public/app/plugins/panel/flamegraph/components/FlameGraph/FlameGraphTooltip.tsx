import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Portal, useStyles2, VizTooltipContainer } from '@grafana/ui';

import { FlameGraphDataContainer, LevelItem } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  position?: { x: number; y: number };
  item?: LevelItem;
};

const FlameGraphTooltip = ({ data, item, totalTicks, position }: Props) => {
  const styles = useStyles2(getStyles);

  if (!(item && position)) {
    return null;
  }

  const tooltipData = getTooltipData(data, item, totalTicks);
  const content = (
    <div className={styles.tooltipContent}>
      <p>{data.getLabel(item.itemIndexes[0])}</p>
      <p className={styles.lastParagraph}>
        {tooltipData.unitTitle}
        <br />
        Total: <b>{tooltipData.unitValue}</b> ({tooltipData.percentValue}%)
        <br />
        Self: <b>{tooltipData.unitSelf}</b> ({tooltipData.percentSelf}%)
        <br />
        Samples: <b>{tooltipData.samples}</b>
      </p>
    </div>
  );

  return (
    <Portal>
      <VizTooltipContainer position={position} offset={{ x: 15, y: 0 }}>
        {content}
      </VizTooltipContainer>
    </Portal>
  );
};

type TooltipData = {
  name: string;
  percentValue: number;
  percentSelf: number;
  unitTitle: string;
  unitValue: string;
  unitSelf: string;
  samples: string;
};

export const getTooltipData = (data: FlameGraphDataContainer, item: LevelItem, totalTicks: number): TooltipData => {
  const displayValue = data.valueDisplayProcessor(item.value);
  const displaySelf = data.getSelfDisplay(item.itemIndexes);

  const percentValue = Math.round(10000 * (displayValue.numeric / totalTicks)) / 100;
  const percentSelf = Math.round(10000 * (displaySelf.numeric / totalTicks)) / 100;
  let unitValue = displayValue.text + displayValue.suffix;
  let unitSelf = displaySelf.text + displaySelf.suffix;

  const unitTitle = data.getUnitTitle();
  if (unitTitle === 'Count') {
    if (!displayValue.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitValue = displayValue.text;
    }
    if (!displaySelf.suffix) {
      // Makes sure we don't show 123undefined or something like that if suffix isn't defined
      unitSelf = displaySelf.text;
    }
  }

  return {
    name: data.getLabel(item.itemIndexes[0]),
    percentValue,
    percentSelf,
    unitTitle,
    unitValue,
    unitSelf,
    samples: displayValue.numeric.toLocaleString(),
  };
};

const getStyles = (theme: GrafanaTheme2) => ({
  tooltipContent: css`
    title: tooltipContent;
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  lastParagraph: css`
    title: lastParagraph;
    margin-bottom: 0;
  `,
  name: css`
    title: name;
    margin-bottom: 10px;
  `,
});

export default FlameGraphTooltip;
