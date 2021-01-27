// Libraries
import React, { FunctionComponent } from 'react';
import { css } from 'emotion';
// Components
import { IconName, IconType, IconSize, IconButton, useTheme, stylesFactory } from '@grafana/ui';
import { GrafanaTheme } from '@grafana/data';

interface Props {
  icon?: IconName;
  tooltip: string;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
  iconType?: IconType;
  iconSize?: IconSize;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, iconType, iconSize, tooltip, onClick, children }) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  return (
    <div className={styles.noBorderContainer}>
      {icon && (
        <IconButton
          name={icon}
          size={iconSize}
          iconType={iconType}
          tooltip={tooltip}
          tooltipPlacement="bottom"
          onClick={onClick}
        />
      )}
      {children}
    </div>
  );
};

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  noBorderContainer: css`
    padding: 0 ${theme.spacing.xs};
    display: flex;
  `,
}));
