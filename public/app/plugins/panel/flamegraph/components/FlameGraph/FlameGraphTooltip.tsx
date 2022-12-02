import { css } from '@emotion/css';
import React, { LegacyRef } from 'react';

import { createTheme, Field, getDisplayProcessor } from '@grafana/data';
import { useStyles2, Tooltip } from '@grafana/ui';

import { TooltipData, SampleUnit } from '../types';

type Props = {
  tooltipRef: LegacyRef<HTMLDivElement>;
  tooltipData: TooltipData;
  showTooltip: boolean;
};

const FlameGraphTooltip = ({ tooltipRef, tooltipData, showTooltip }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <div ref={tooltipRef} className={styles.tooltip}>
      {tooltipData && showTooltip && (
        <Tooltip
          content={
            <div>
              <p>{tooltipData.name}</p>
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
      )}
    </div>
  );
};

export const getTooltipData = (
  field: Field,
  label: string,
  value: number,
  self: number,
  totalTicks: number
): TooltipData => {
  let percentTitle;
  let unitTitle;

  const processor = getDisplayProcessor({ field, theme: createTheme() /* theme does not matter for us here */ });
  const displayValue = processor(value);
  const displaySelf = processor(self);

  const percentValue = Math.round(10000 * (value / totalTicks)) / 100;
  const percentSelf = Math.round(10000 * (self / totalTicks)) / 100;
  let unitValue = displayValue.text + displayValue.suffix;
  let unitSelf = displaySelf.text + displaySelf.suffix;

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
      if (!displayValue.suffix) {
        // Makes sure we don't show 123undefined or something like that if suffix isn't defined
        unitValue = displayValue.text;
      }
      if (!displaySelf.suffix) {
        // Makes sure we don't show 123undefined or something like that if suffix isn't defined
        unitSelf = displaySelf.text;
      }
      break;
  }

  return {
    name: label,
    percentTitle,
    percentValue,
    percentSelf,
    unitTitle,
    unitValue,
    unitSelf,
    samples: value.toLocaleString(),
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
