import { IconButton, IconName, stylesFactory, useTheme } from '@grafana/ui';
import React from 'react';
import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

interface QueryOperationActionProps {
  icon: IconName;
  title: string;
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
    <IconButton
      name={icon}
      title={title}
      className={styles.icon}
      disabled={!!disabled}
      onClick={onClick}
      surface="header"
      aria-label={selectors.components.QueryEditorRow.actionButton(title)}
    />
  );
};

QueryOperationAction.displayName = 'QueryOperationAction';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    icon: css`
      color: ${theme.colors.textWeak};
    `,
  };
});
