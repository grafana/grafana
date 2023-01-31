import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { HorizontalGroup, Icon, useStyles2 } from '@grafana/ui';

interface Props {
  step: number;
  onChange: (newStep: number) => void;
}

export const SAMLStepSelector = ({ step, onChange }: Props): JSX.Element => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <HorizontalGroup>
        <div className={cx(styles.stepContainer, { [styles.active]: step === 1 })} onClick={() => onChange(1)}>
          <Icon name="check" className={styles.icon} />
          <span>General Settings</span>
        </div>
        <div className={styles.separator}>---</div>
        <div className={cx(styles.stepContainer, { [styles.active]: step === 2 })} onClick={() => onChange(2)}>
          <Icon name="check" className={styles.icon} />
          <span>Key and certificate</span>
        </div>
        <div className={styles.separator}>---</div>
        <div className={cx(styles.stepContainer, { [styles.active]: step === 3 })} onClick={() => onChange(3)}>
          <Icon name="check" />
          <span>Connect Grafana with IdP</span>
        </div>
        <div className={styles.separator}>---</div>
        <div className={cx(styles.stepContainer, { [styles.active]: step === 4 })} onClick={() => onChange(4)}>
          <Icon name="check" />
          <span>Assettion mapping</span>
        </div>
        <div className={styles.separator}>---</div>
        <div className={cx(styles.stepContainer, { [styles.active]: step === 5 })} onClick={() => onChange(5)}>
          <Icon name="check" />
          <span>Test and save</span>
        </div>
      </HorizontalGroup>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css`
      display: flex;
      height: ${theme.spacing(6)};
      padding: ${theme.spacing(2)};
      margin: ${theme.spacing(2)} 0;
      border-radius: ${theme.shape.borderRadius(1)};
      border: 1px solid ${theme.colors.border.medium};
    `,
    stepContainer: css`
      cursor: pointer;
      color: ${theme.colors.text.secondary};
    `,
    active: css`
      color: ${theme.colors.text.primary};
    `,
    separator: css`
      color: ${theme.colors.secondary.shade};
      white-space: nowrap;
    `,
    icon: css`
      color: ${theme.colors.success.text};
    `,
  };
};
