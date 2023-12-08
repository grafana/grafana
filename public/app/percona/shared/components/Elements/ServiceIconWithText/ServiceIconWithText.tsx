import React, { FC } from 'react';

import { Icon, IconName, useStyles2 } from '@grafana/ui';
import { DATABASE_ICONS } from 'app/percona/shared/core';

import { getStyles } from './ServiceIconWithText.styles';
import { ServiceIconWithTextProps } from './ServiceIconWithText.types';

export const ServiceIconWithText: FC<ServiceIconWithTextProps> = ({ dbType, text }) => {
  // @ts-ignore
  const icon: IconName = DATABASE_ICONS[dbType];
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.wrapper}>
      {!!icon && <Icon name={icon} data-testid="service-icon" />}
      <span>{text}</span>
    </div>
  );
};
