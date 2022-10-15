import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes';

interface Props {
  label: string | undefined;
  children?: React.ReactNode;
}

const stopPropagation = (event: React.MouseEvent) => event.stopPropagation();

export const TimeZoneGroup = (props: Props) => {
  const { children, label } = props;
  const styles = useStyles2(getStyles);

  if (!label) {
    return <div onClick={stopPropagation}>{children}</div>;
  }

  return (
    <div onClick={stopPropagation}>
      <div className={styles.header}>
        <span className={styles.label}>{label}</span>
      </div>
      {children}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      padding: 7px 10px;
      width: 100%;
      border-top: 1px solid ${theme.colors.border.weak};
      text-transform: capitalize;
    `,
    label: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightMedium};
    `,
  };
};
