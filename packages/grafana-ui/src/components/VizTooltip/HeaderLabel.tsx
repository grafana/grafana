import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';

import { VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { LabelValue } from './types';

interface Props {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: Props) => {
  const styles = useStyles2(getStyles);

  const { label, value, color, colorIndicator } = headerLabel;

  return (
    <div className={styles.wrapper}>
      {color && <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator!} />}
      {label && <span className={styles.label}>{label}</span>}
      <span className={styles.labelValue}>{value}</span>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  hgContainer: css({
    flexGrow: 1,
  }),
  label: css({
    color: theme.colors.text.secondary,
    paddingRight: theme.spacing(0.5),
    fontWeight: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: '48px',
  }),
  labelValue: css({
    fontWeight: 500,
    lineHeight: '18px',
    alignSelf: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
  wrapper: css({
    display: 'flex',
    alignItems: 'center',
    width: '244px',
  }),
});
