import { css } from '@emotion/css';
import { memo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { TimePickerButtonLabel, TimeRangePickerProps } from '../TimeRangePicker';
import { isValidTimeRange } from '../utils';

type LabelProps = Pick<TimeRangePickerProps, 'hideText' | 'value' | 'timeZone'> & {
  placeholder?: string;
  className?: string;
};

export const TimeRangeLabel = memo<LabelProps>(function TimePickerLabel({
  hideText,
  value,
  timeZone = 'browser',
  placeholder = 'No time range selected',
  className,
}) {
  const styles = useStyles2(getLabelStyles);

  if (hideText) {
    return null;
  }

  return (
    <span className={className}>
      {isValidTimeRange(value) ? (
        <TimePickerButtonLabel value={value} timeZone={timeZone} />
      ) : (
        <span className={styles.placeholder}>{placeholder}</span>
      )}
    </span>
  );
});

const getLabelStyles = (theme: GrafanaTheme2) => {
  return {
    placeholder: css({
      color: theme.colors.text.disabled,
      opacity: 1,
    }),
  };
};
