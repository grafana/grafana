import { css } from '@emotion/css';
import React, { LegacyRef } from 'react';

import { createTheme, Field, getDisplayProcessor } from '@grafana/data';
import { useStyles, Tooltip } from '@grafana/ui';

import { TooltipData, SampleUnit } from '../types';

type Props = {
  tooltipRef: LegacyRef<HTMLDivElement>;
  tooltipData: TooltipData;
  showTooltip: boolean;
};

const FlameGraphTooltip = ({ tooltipRef, tooltipData, showTooltip }: Props) => {
  const styles = useStyles(getStyles);

  return (
    <div ref={tooltipRef} className={styles.tooltip}>
      {tooltipData && showTooltip && (
        <Tooltip
          content={
            <div>
              <div className={styles.name}>{tooltipData.name}</div>
              <div>
                {tooltipData.percentTitle}: <b>{tooltipData.percentValue}%</b>
              </div>
              <div>
                {tooltipData.unitTitle}: <b>{tooltipData.unitValue}</b>
              </div>
              <div>
                Samples: <b>{tooltipData.samples}</b>
              </div>
            </div>
          }
          placement={'right'}
          show={true}
        >
          <span></span>
        </Tooltip>
      )}
    </div>
  );
};

export const getTooltipData = (field: Field, label: string, value: number, totalTicks: number): TooltipData => {
  let samples = value;

  const processor = getDisplayProcessor({ field, theme: createTheme() /* theme does not matter for us here */ });
  const displayValue = processor(value);
  const percent = Math.round(10000 * (samples / totalTicks)) / 100;
  const titles = getTitles(field);

  // Makes sure we don't show 123undefined or something like that if suffix isn't defined
  let unitValue = displayValue.suffix ? displayValue.text + displayValue.suffix : displayValue.text;

  return {
    name: label,
    percentTitle: titles.percentTitle,
    percentValue: percent,
    unitTitle: titles.unitTitle,
    unitValue,
    samples: samples.toLocaleString(),
  };
};

const getTitles = (field: Field) => {
  let percentTitle = '';
  let unitTitle = '';

  switch (field.config.unit) {
    case SampleUnit.Bytes:
      percentTitle = '% of total';
      unitTitle = 'RAM';
      break;
    case SampleUnit.Nanoseconds:
      percentTitle = '% of total time';
      unitTitle = 'Time';
      break;
    default:
      percentTitle = '% of total';
      unitTitle = 'Count';
      break;
  }

  return {
    percentTitle: percentTitle,
    unitTitle: unitTitle,
  };
};

const getStyles = () => ({
  tooltip: css`
    position: fixed;
  `,
  name: css`
    margin-bottom: 10px;
  `,
});

export default FlameGraphTooltip;
