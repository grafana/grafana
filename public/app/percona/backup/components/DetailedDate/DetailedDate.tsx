import { cx } from '@emotion/css';
import moment from 'moment/moment';
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
  const momentObj = moment(date);
  const dayTime = momentObj.format(dayFormat);
  const hourTime = momentObj.format(hourFormat);

  return (
    <span data-testid={dataTestId} className={cx(className, styles.timeWrapper)}>
      <span>{dayTime}</span>
      <span className={styles.hourWrapper}>{hourTime}</span>
    </span>
  );
};
