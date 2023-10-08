import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { Tooltip, VerticalGroup } from '..';
import { useStyles2 } from '../../themes';

import { LabelValue } from './types';

interface Props {
  headerLabel: LabelValue[];
}

export const HeaderLabel = ({ headerLabel }: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <VerticalGroup justify-content="space-between" spacing="lg">
      <div className={styles.wrapper}>
        {headerLabel.map((label, index) => {
          const { color } = label;
          return (
            <div key={index} className={styles.header}>
              <span className={styles.label}>
                {color ? <span className={styles.labelColor} style={{ backgroundColor: color }}></span> : null}
                {label.label}
              </span>
              <Tooltip content={label.value ? label.value.toString() : ''}>
                <span className={styles.value}>{label.value}</span>
              </Tooltip>
            </div>
          );
        })}
      </div>
    </VerticalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css({
    display: 'flex',
    alignItems: 'center',
    color: theme.colors.text.secondary,
    paddingRight: theme.spacing(0.5),
    fontWeight: 400,
  }),
  labelColor: css({
    width: '12px',
    height: '12px',
    display: 'inline-block',
    borderRadius: '2px',
    marginRight: '4px',
  }),
  value: css({
    fontWeight: 500,
    lineHeight: '18px',
    alignSelf: 'center',
  }),
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    // maskImage: 'linear-gradient(90deg, rgba(0, 0, 0, 1) 80%, transparent)',
  }),
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    width: '250px',
  }),
});
