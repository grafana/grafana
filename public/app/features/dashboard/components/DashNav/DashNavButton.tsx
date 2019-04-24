// Libraries
import React, { FunctionComponent } from 'react';

// Components
import { Tooltip } from '@grafana/ui';

interface Props {
  icon: string;
  tooltip: string;
  classSuffix: string;
  onClick?: () => void;
  href?: string;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, tooltip, classSuffix, onClick, href }) => {
  if (onClick) {
    return (
      <Tooltip content={tooltip}>
        <button className={`btn navbar-button navbar-button--${classSuffix}`} onClick={onClick}>
          <i className={icon} />
        </button>
      </Tooltip>
    );
  }

  return (
    <Tooltip content={tooltip}>
      <a className={`btn navbar-button navbar-button--${classSuffix}`} href={href}>
        <i className={icon} />
      </a>
    </Tooltip>
  );
};
