// Libraries
import React, { FunctionComponent } from 'react';
// Components
import { Tooltip } from '@grafana/ui';
import { e2e } from '@grafana/e2e';

interface Props {
  icon?: string;
  tooltip: string;
  classSuffix?: string;
  onClick?: () => void;
  href?: string;
  children?: React.ReactNode;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, tooltip, classSuffix, onClick, href, children }) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip} placement="bottom">
        <button
          className={`btn navbar-button navbar-button--${classSuffix}`}
          onClick={onClick}
          aria-label={e2e.pages.Dashboard.Toolbar.selectors.toolbarItems(tooltip)}
        >
          {icon && <i className={icon} />}
          {children}
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip} placement="bottom">
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        {icon && <i className={icon} />}
        {children}
      </a>
    </Tooltip>
  );
};
