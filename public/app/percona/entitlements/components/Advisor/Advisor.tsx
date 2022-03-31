import { Icon, useStyles2 } from '@grafana/ui';
import React from 'react';
import { getStyles } from './Advisor.styles';
import { AdvisorProps } from './Advisor.types';

export const Advisor = ({ label, hasAdvisor }: AdvisorProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.advisorWrapper}>
      <span className={styles.tab}>{label}:</span>
      {hasAdvisor ? (
        <Icon data-testid="advisor-check-icon" name="check" className={styles.checkIcon} />
      ) : (
        <Icon data-testid="advisor-times-icon" name="times" className={styles.timesIcon} />
      )}
    </div>
  );
};
