import React from 'react';
import { Forms, Icon, stylesFactory, useTheme } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';
import { css } from 'emotion';

interface OverrideHeaderProps {
  title: string;
  description?: string;
  onRemove: () => void;
}

export const OverrideHeader: React.FC<OverrideHeaderProps> = ({ title, description, onRemove }) => {
  const theme = useTheme();
  const styles = getOverrideHeaderStyles(theme);
  return (
    <div className={styles.header}>
      <Forms.Label description={description}>{title}</Forms.Label>
      <div className={styles.remove} onClick={() => onRemove()}>
        <Icon name="trash" />
      </div>
    </div>
  );
};

const getOverrideHeaderStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    header: css`
      display: flex;
      justify-content: space-between;
      padding: ${theme.spacing.xs} ${theme.spacing.xs} 0 ${theme.spacing.xs};
    `,
    remove: css`
      flex-grow: 0;
      flex-shrink: 0;
      cursor: pointer;
      color: ${theme.colors.red88};
    `,
  };
});
