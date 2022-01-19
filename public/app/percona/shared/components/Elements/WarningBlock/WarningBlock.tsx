import React, { FC } from 'react';
import { cx } from 'emotion';
import { Icon, IconName, useStyles } from '@grafana/ui';
import { WarningBlockProps, WarningType } from './WarningBlock.types';
import { getStyles } from './WarningBlock.styles';

const WarningIconMap: Record<WarningType, IconName> = {
  info: 'info-circle',
  warning: 'exclamation-triangle',
};

export const WarningBlock: FC<WarningBlockProps> = ({
  message,
  className,
  type = 'info',
  dataTestId = 'warning-block',
}) => {
  const styles = useStyles(getStyles);

  return (
    <div className={cx(styles.warningWrapper, className)} data-testid={dataTestId}>
      <Icon className={styles.warningIcon} size="xl" name={WarningIconMap[type]} />
      <span>{message}</span>
    </div>
  );
};
