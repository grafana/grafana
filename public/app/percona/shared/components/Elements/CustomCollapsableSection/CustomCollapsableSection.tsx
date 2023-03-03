import React, { useContext } from 'react';

import { ControlledCollapse, useTheme2 } from '@grafana/ui';

import { IsDisabledContext } from './CustomCollapsableSection.context';
import { getStyles } from './CustomCollapsableSection.styles';
import { CustomCollapsableSectionProps } from './CustomCollapsableSection.types';

export const CustomCollapsableSection = ({
  children,
  mainLabel,
  content,
  sideLabel,
}: CustomCollapsableSectionProps) => {
  //used to automatically disable collapse when wrapping in UpgradePlanWrapper
  const disabled = useContext(IsDisabledContext);
  const theme = useTheme2();
  const styles = getStyles(theme, disabled);
  return (
    <ControlledCollapse
      label={
        <div className={styles.collapsableLabel}>
          <span className={styles.mainLabel}>{mainLabel}</span>
          <span className={styles.label}>{content}</span>
          <span className={styles.label}>{sideLabel}</span>
        </div>
      }
      className={styles.collapsableSection}
      bodyCustomClass={styles.collapsableBody}
      headerCustomClass={styles.collapsableHeader}
      headerLabelCustomClass={styles.collapsableHeaderLabel}
      disabled={disabled}
    >
      {children}
    </ControlledCollapse>
  );
};
