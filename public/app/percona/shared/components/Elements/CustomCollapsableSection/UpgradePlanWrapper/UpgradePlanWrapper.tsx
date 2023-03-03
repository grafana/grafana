import React from 'react';

import { Button, Icon, useStyles2 } from '@grafana/ui';

import { IsDisabledContext } from '../CustomCollapsableSection.context';

import { getStyles } from './UpgradePlanWrapper.style';
import { UpgradePlanWrapperProps } from './UpgradePlanWrapper.type';

export const UpgradePlanWrapper = ({ label, buttonLabel, buttonOnClick, children }: UpgradePlanWrapperProps) => {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <div className={styles.headerLabel}>
          <Icon name="lock" /> {label}
        </div>
        <Button variant="secondary" onClick={buttonOnClick}>
          {buttonLabel}
        </Button>
      </div>
      <div className={styles.children}>
        <IsDisabledContext.Provider value={true}>{children}</IsDisabledContext.Provider>
      </div>
    </div>
  );
};
