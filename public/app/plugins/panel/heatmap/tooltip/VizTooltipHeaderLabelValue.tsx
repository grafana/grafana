import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';

import { ColorIndicator, LabelValue } from './tooltipUtils';

interface VizTooltipHeaderKeyValueProps {
  keyValuePairs?: LabelValue[];
}
export const VizTooltipHeaderLabelValue = ({ keyValuePairs }: VizTooltipHeaderKeyValueProps) => {
  const styles = useStyles2(getStyles);

  const getColorIndicatorClass = (colorIndicator: string) => {
    switch (colorIndicator) {
      case ColorIndicator.value:
        return styles.value;
      case ColorIndicator.series:
        return styles.series;
      case ColorIndicator.hexagon:
        return styles.hexagon;
      case ColorIndicator.pie_1_4:
        return styles.pie_1_4;
      case ColorIndicator.pie_2_4:
        return styles.pie_2_4;
      case ColorIndicator.pie_3_4:
        return styles.pie_3_4;
      case ColorIndicator.marker_sm:
        return styles.marker_sm;
      case ColorIndicator.marker_md:
        return styles.marker_md;
      case ColorIndicator.marker_lg:
        return styles.marker_lg;
      default:
        return styles.value;
    }
  };

  return (
    <>
      {keyValuePairs?.map((keyValuePair, i) => {
        return (
          <HorizontalGroup justify="space-between" spacing="md" className={styles.hgContainer} key={i}>
            <div className={styles.label}>{keyValuePair.label}</div>
            <>
              <span
                style={{ backgroundColor: keyValuePair.color }}
                className={cx(styles.colorIndicator, getColorIndicatorClass(keyValuePair.colorIndicator!))}
              />
              {keyValuePair.value}
            </>
          </HorizontalGroup>
        );
      })}
    </>
  );
};

// @TODO Update classes/add svgs?
const getStyles = (theme: GrafanaTheme2) => ({
  hgContainer: css`
    flex-grow: 1;
  `,
  colorIndicator: css`
    margin-right: ${theme.spacing(0.5)};
  `,
  label: css`
    color: ${theme.colors.text.secondary};
    font-weight: 400;
  `,
  series: css`
    width: 14px;
    height: 4px;
    border-radius: ${theme.shape.radius.pill};
  `,
  value: css`
    width: 12px;
    height: 12px;
    border-radius: ${theme.shape.radius.default};
    font-weight: 500;
  `,
  hexagon: css``,
  pie_1_4: css``,
  pie_2_4: css``,
  pie_3_4: css``,
  marker_sm: css`
    width: 4px;
    height: 4px;
    border-radius: ${theme.shape.radius.circle};
  `,
  marker_md: css`
    width: 8px;
    height: 8px;
    border-radius: ${theme.shape.radius.circle};
  `,
  marker_lg: css`
    width: 12px;
    height: 12px;
    border-radius: ${theme.shape.radius.circle};
  `,
});
