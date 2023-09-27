import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, Tooltip, useStyles2 } from '@grafana/ui';

import { LabelValue } from './tooltipUtils';

interface HeaderLabelProps {
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ headerLabel }: HeaderLabelProps) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg" wrap maxLength={240}>
      <div className={styles.wrapper}>
        <span className={styles.label}>{headerLabel.label}</span>
        <Tooltip content={headerLabel.value}>
          <span className={styles.value}>{headerLabel.value}</span>
        </Tooltip>
        <span className={styles.fadedMask}></span>
      </div>
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
    padding-right: ${theme.spacing(0.5)};
  `,
  value: css`
    font-weight: 500;
    line-height: 18px;
    align-self: center;
    max-width: 220px;
  `,
  wrapper: css`
    display: flex;
    flex-direction: row;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
    //-webkit-mask-image: linear-gradient(90deg, #000 60%, transparent);
  `,
  fadedMask: css`
    display: block;
    position: absolute;
    width: 200px;
    height: 12px;
    right: 25px;
    top: 12px;
    pointer-events: none;
    background: linear-gradient(to right, transparent 30%, ${theme.colors.background.secondary} 100%);
    background: -webkit-gradient(
      linear,
      left top,
      right top,
      color-stop(0%, transparent),
      color-stop(100%, ${theme.colors.background.secondary})
    );
    background: -webkit-linear-gradient(left, transparent 30%, ${theme.colors.background.secondary} 100%);
  `,
});
