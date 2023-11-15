import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Tooltip } from '../Tooltip';

import { VizTooltipColorIndicator } from './VizTooltipColorIndicator';
import { LabelValue } from './types';

interface Props extends LabelValue {
  justify?: string;
  colorFirst?: boolean;
  isActive?: boolean; // for series list
  marginRight?: string;
}

export const VizTooltipRow = ({
  label,
  value,
  color,
  colorIndicator,
  justify = 'flex-start',
  colorFirst = true,
  isActive = false,
  marginRight = '0px',
}: Props) => {
  const styles = useStyles2(getStyles, justify, marginRight);

  const [showLabelTooltip, setShowLabelTooltip] = useState(false);
  const [showValueTooltip, setShowValueTooltip] = useState(false);

  const onMouseEnterLabel = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget.offsetWidth < event.currentTarget.scrollWidth) {
      setShowLabelTooltip(true);
    }
  };

  const onMouseLeaveLabel = () => setShowLabelTooltip(false);

  const onMouseEnterValue = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.currentTarget.offsetWidth < event.currentTarget.scrollWidth) {
      setShowValueTooltip(true);
    }
  };

  const onMouseLeaveValue = () => setShowValueTooltip(false);

  return (
    <div className={styles.contentWrapper}>
      {(color || label) && (
        <div className={styles.valueWrapper}>
          {color && colorFirst && <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator!} />}
          <Tooltip content={label} interactive={false} show={showLabelTooltip}>
            <div
              className={cx(styles.label, isActive && styles.activeSeries)}
              onMouseEnter={onMouseEnterLabel}
              onMouseLeave={onMouseLeaveLabel}
            >
              {label}
            </div>
          </Tooltip>
        </div>
      )}

      <div className={styles.valueWrapper}>
        {color && !colorFirst && <VizTooltipColorIndicator color={color} colorIndicator={colorIndicator!} />}
        <Tooltip content={value ? value.toString() : ''} interactive={false} show={showValueTooltip}>
          <div className={cx(styles.value, isActive)} onMouseEnter={onMouseEnterValue} onMouseLeave={onMouseLeaveValue}>
            {value}
          </div>
        </Tooltip>
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2, justify: string, marginRight: string) => ({
  wrapper: css({
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    gap: 4,
    borderTop: `1px solid ${theme.colors.border.medium}`,
    padding: theme.spacing(1),
  }),
  contentWrapper: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: justify,
    flexWrap: 'wrap',
    marginRight: marginRight,
  }),
  customContentPadding: css({
    padding: `${theme.spacing(1)} 0`,
  }),
  label: css({
    color: theme.colors.text.secondary,
    fontWeight: 400,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
    marginRight: theme.spacing(0.5),
  }),
  value: css({
    fontWeight: 500,
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  }),
  valueWrapper: css({
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  }),
  activeSeries: css({
    fontWeight: theme.typography.fontWeightBold,
    color: theme.colors.text.maxContrast,
  }),
});
