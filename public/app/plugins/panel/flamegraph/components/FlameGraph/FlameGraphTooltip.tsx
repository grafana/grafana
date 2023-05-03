import { css } from '@emotion/css';
import React, { LegacyRef } from 'react';

import { useStyles2, Tooltip } from '@grafana/ui';

import { FlameGraphDataContainer, LevelItem } from './dataTransform';

type Props = {
  data: FlameGraphDataContainer;
  totalTicks: number;
  item?: LevelItem;
  tooltipRef?: LegacyRef<HTMLDivElement>;
};

const FlameGraphTooltip = ({ data, tooltipRef, item, totalTicks }: Props) => {
  const styles = useStyles2(getStyles);

  let content = null;
  if (item) {
    const tooltipData = getTooltipData(data, item, totalTicks);
    content = (
      <Tooltip
        content={
          <div>
            <p>{data.getLabel(item.itemIndex)}</p>
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
        }
        placement={'right'}
        show={true}
      >
        <span></span>
      </Tooltip>
    );
  }

  // Even if we don't show tooltip we need this div so the ref is consistently attached. Would need some refactor in
  // FlameGraph.tsx to make it work without it.
  return (
    <div ref={tooltipRef} className={styles.tooltip}>
      {content}
    </div>
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
  const displayValue = data.getValueDisplay(item.itemIndex);
  const displaySelf = data.getSelfDisplay(item.itemIndex);

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
    name: data.getLabel(item.itemIndex),
    percentValue,
    percentSelf,
    unitTitle,
    unitValue,
    unitSelf,
    samples: displayValue.numeric.toLocaleString(),
  };
};

const getStyles = () => ({
  tooltip: css`
    position: fixed;
  `,
  lastParagraph: css`
    margin-bottom: 0;
  `,
  name: css`
    margin-bottom: 10px;
  `,
});

export default FlameGraphTooltip;
