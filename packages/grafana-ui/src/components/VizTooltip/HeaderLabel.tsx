import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { HorizontalGroup, Tooltip } from '..';
import { useStyles2 } from '../../themes';

import { LabelValue } from './types';

interface Props {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg" wrap>
      <div className={styles.wrapper}>
        <span className={styles.label}>{headerLabel.label}</span>
        <Tooltip content={headerLabel.value ? headerLabel.value.toString() : ''}>
          <span className={styles.value}>{headerLabel.value}</span>
        </Tooltip>
      </div>
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    color: theme.colors.text.secondary,
    paddingRight: theme.spacing(0.5),
    fontWeight: 400,
  }),
  value: css({
    fontWeight: 500,
    lineHeight: '18px',
    alignSelf: 'center',
  }),
  wrapper: css({
    display: 'flex',
    flexDirection: 'row',
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    width: '250px',
    maskImage: 'linear-gradient(90deg, rgba(0, 0, 0, 1) 80%, transparent)',
  }),
});
