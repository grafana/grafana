// Libraries
import { css } from '@emotion/css';
import React, { FunctionComponent, MouseEvent } from 'react';

// Components
import { GrafanaTheme2 } from '@grafana/data';
import { IconName, IconType, IconSize, IconButton, useStyles2 } from '@grafana/ui';

interface Props {
  icon?: IconName;
  tooltip: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  href?: string;
  children?: React.ReactNode;
  iconType?: IconType;
  iconSize?: IconSize;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, iconType, iconSize, tooltip, onClick, children }) => {
  const styles = useStyles2(getStyles);

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

const getStyles = (theme: GrafanaTheme2) => ({
  noBorderContainer: css`
    padding: 0 ${theme.spacing(0.5)};
    display: flex;
  `,
});
