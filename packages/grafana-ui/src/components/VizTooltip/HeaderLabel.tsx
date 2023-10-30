import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { HorizontalGroup, Tooltip } from '..';
import { useStyles2 } from '../../themes';

import { LabelValue } from './types';
import { getColorIndicatorClass } from './utils';

interface Props {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: Props) => {
  const styles = useStyles2(getStyles);

  const { label, value, color, colorIndicator } = headerLabel;

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg" wrap>
      <div className={styles.wrapper}>
        <span className={styles.label}>{label}</span>
        {color && (
          <span
            style={{ backgroundColor: color }}
            className={cx(styles.colorIndicator, getColorIndicatorClass(colorIndicator!, styles))}
          />
        )}
        <Tooltip content={value ? value.toString() : ''}>
          <span className={styles.labelValue}>{value}</span>
        </Tooltip>
      </div>
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  hgContainer: css({
    flexGrow: 1,
  }),
  colorIndicator: css({
    marginRight: theme.spacing(0.5),
  }),
  label: css({
    color: theme.colors.text.secondary,
    paddingRight: theme.spacing(0.5),
    fontWeight: 400,
  }),
  value: css({
    width: '12px',
    height: '12px',
    borderRadius: theme.shape.radius.default,
  }),
  series: css({
    width: '14px',
    height: '4px',
    borderRadius: theme.shape.radius.pill,
  }),
  labelValue: css({
    fontWeight: 500,
    lineHeight: '18px',
    alignSelf: 'center',
  }),
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    flexDirection: 'row',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    width: '250px',
    maskImage: 'linear-gradient(90deg, rgba(0, 0, 0, 1) 80%, transparent)',
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
