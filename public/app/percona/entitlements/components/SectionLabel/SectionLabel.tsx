import React from 'react';

import { useStyles2 } from '@grafana/ui';

import { Messages } from './SectionLabel.messages';
import { getStyles } from './SectionLabel.styles';
import { LabelProps } from './SectionLabel.types';

export const Label = ({ name, endDate }: LabelProps) => {
  const styles = useStyles2(getStyles);
  return (
    <span className={styles.labelWrapper}>
      {name}
      <span className={styles.label}>
        {Messages.expiryDate}: {endDate}
      </span>
    </span>
  );
};
