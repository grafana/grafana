import React, { PropsWithChildren } from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { useTheme, stylesFactory } from '../../../themes';

interface Props {
  label: string | undefined;
}

const stopPropagation = (event: React.MouseEvent) => event.stopPropagation();

export const TimeZoneGroup: React.FC<PropsWithChildren<Props>> = props => {
  const theme = useTheme();
  const { children, label } = props;
  const styles = getStyles(theme);

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

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      padding: 7px 10px;
      width: 100%;
      border-top: 1px solid ${theme.colors.border1};
      text-transform: capitalize;
    `,
    label: css`
      font-size: ${theme.typography.size.sm};
      color: ${theme.colors.textWeak};
      font-weight: ${theme.typography.weight.semibold};
    `,
  };
});
