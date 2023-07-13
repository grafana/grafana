import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, useStyles2 } from '@grafana/ui';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';

import { LabelValue } from './tooltipUtils';

interface HeaderLabelProps {
  showCloseButton: boolean;
  onClose: () => void;
  headerLabel: LabelValue;
}

export const HeaderLabel = ({ showCloseButton, headerLabel, onClose }: HeaderLabelProps) => {
  const styles = useStyles2(getStyles);

  return (
    <HorizontalGroup justify-content="space-between" spacing="lg">
      <div>
        <span className={styles.label}>{headerLabel.label}</span>{' '}
        <span className={styles.value}>{headerLabel.value}</span>
      </div>
      {showCloseButton && <CloseButton onClick={onClose} style={{ position: 'absolute', top: '20px', right: '8px' }} />}
    </HorizontalGroup>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.text.secondary};
  `,
  value: css`
    font-weight: 500;
    line-height: 18px;
  `,
});
