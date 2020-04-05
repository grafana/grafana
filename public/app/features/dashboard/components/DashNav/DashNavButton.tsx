// Libraries
import React, { FunctionComponent } from 'react';
// Components
import { Tooltip, Icon, IconName, IconType } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

interface Props {
  icon?: IconName;
  tooltip: string;
  classSuffix?: string;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
  iconType?: IconType;
}

export const DashNavButton: FunctionComponent<Props> = ({
  icon,
  iconType,
  tooltip,
  classSuffix,
  onClick,
  href,
  children,
}) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip} placement="bottom">
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={e2e.pages.Dashboard.Toolbar.selectors.toolbarItems(tooltip)}
        >
          {icon && <Icon name={icon} type={iconType} />}
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip} placement="bottom">
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        {icon && <Icon name={icon} type={iconType} />}
        {children}
      </a>
    </Tooltip>
  );
};
