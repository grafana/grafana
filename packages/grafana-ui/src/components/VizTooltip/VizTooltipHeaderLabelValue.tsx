import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { HorizontalGroup } from '..';
import { useStyles2 } from '../../themes';

import { LabelValue } from './types';
import { getColorIndicatorClass } from './utils';

interface Props {
  keyValuePairs?: LabelValue[];
}

export type HeaderLabelValueStyles = ReturnType<typeof getStyles>;

export const VizTooltipHeaderLabelValue = ({ keyValuePairs }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <>
      {keyValuePairs?.map((keyValuePair, i) => {
        return (
          <HorizontalGroup justify="space-between" spacing="md" className={styles.hgContainer} key={i}>
            <div className={styles.label}>{keyValuePair.label}</div>
            <>
              <span
                style={{ backgroundColor: keyValuePair.color }}
                className={cx(styles.colorIndicator, getColorIndicatorClass(keyValuePair.colorIndicator!, styles))}
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
  hgContainer: css({
    flexGrow: 1,
  }),
  colorIndicator: css({
    marginRight: theme.spacing(0.5),
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
  }),
  series: css({
    width: '14px',
    height: '4px',
    borderRadius: theme.shape.radius.pill,
  }),
  value: css({
    width: '12px',
    height: '12px',
    borderRadius: theme.shape.radius.default,
    fontWeight: 500,
  }),
  hexagon: css({}),
  pie_1_4: css({}),
  pie_2_4: css({}),
  pie_3_4: css({}),
  marker_sm: css({
    width: '4px',
    height: '4px',
    borderRadius: theme.shape.radius.circle,
  }),
  marker_md: css({
    width: '8px',
    height: '8px',
    borderRadius: theme.shape.radius.circle,
  }),
  marker_lg: css({
    width: '12px',
    height: '12px',
    borderRadius: theme.shape.radius.circle,
  }),
});
