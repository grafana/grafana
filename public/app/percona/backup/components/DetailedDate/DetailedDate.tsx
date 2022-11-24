import { cx } from '@emotion/css';
import { format } from 'date-fns';
import React, { FC } from 'react';

import { useStyles } from '@grafana/ui';

import { DAY_FORMAT, HOUR_FORMAT } from './DetailedDate.constants';
import { getStyles } from './DetailedDate.styles';
import { DetailedDateProps } from './DetailedDate.types';

export const DetailedDate: FC<DetailedDateProps> = ({
  date,
  dayFormat = DAY_FORMAT,
  hourFormat = HOUR_FORMAT,
  dataTestId = 'detailed-date',
  className,
}) => {
  const styles = useStyles(getStyles);
  const dayTime = format(date, dayFormat);
  const hourTime = format(date, hourFormat);

  return (
    <span data-testid={dataTestId} className={cx(className, styles.timeWrapper)}>
      <span>{dayTime}</span>
      <span className={styles.hourWrapper}>{hourTime}</span>
    </span>
  );
};
