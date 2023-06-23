import { css } from '@emotion/css';
import React, { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../../src/themes';
import { TimePickerButtonLabel, TimeRangePickerProps } from '../TimeRangePicker';
import { isValidTimeRange } from '../utils';

type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone'> & { placeholder?: string };

export const TimeRangeLabel = memo<LabelProps>(function TimePickerLabel({
  hideText,
  value,
  timeZone = 'browser',
  placeholder = 'No time range selected',
}) {
  const styles = useStyles2(getLabelStyles);

  if (hideText) {
    return null;
  }

  return isValidTimeRange(value) ? (
    <TimePickerButtonLabel value={value} timeZone={timeZone} />
  ) : (
    <span className={styles.placeholder}>{placeholder}</span>
  );
});

TimeRangeLabel.displayName = 'TimePickerLabel';

const getLabelStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      align-items: center;
      white-space: nowrap;
    `,
    utc: css`
      color: ${theme.v1.palette.orange};
      font-size: ${theme.typography.size.sm};
      padding-left: 6px;
      line-height: 28px;
      vertical-align: bottom;
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    placeholder: css`
      color: ${theme.colors.text.disabled};
      opacity: 1;
    `,
  };
};
