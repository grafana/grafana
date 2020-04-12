import { IconName, IconButton, stylesFactory, useTheme } from '@grafana/ui';
import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';

interface QueryOperationActionProps {
  icon: IconName;
  title?: string;
  onClick: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

export const QueryOperationAction: React.FC<QueryOperationActionProps> = ({ icon, disabled, title, ...otherProps }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const onClick = (e: React.MouseEvent) => {
    if (!disabled) {
      otherProps.onClick(e);
    }
  };
  return (
    <div title={title}>
      <IconButton
        name={icon}
        className={styles.icon}
        disabled={!!disabled}
        onClick={onClick}
        aria-label={`${title} query operation action`}
      />
    </div>
  );
};

QueryOperationAction.displayName = 'QueryOperationAction';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.palette.textWeak};
    `,
  };
});
