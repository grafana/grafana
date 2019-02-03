// Libraries
import React, { FunctionComponent } from 'react';

// Components
import { Tooltip } from '@grafana/ui';

interface Props {
  icon: string;
  tooltip: string;
  classSuffix: string;
  onClick: () => void;
}

export const DashNavButton: FunctionComponent<Props> = ({ icon, tooltip, classSuffix, onClick }) => {
  return (
    <Tooltip content={tooltip} placement="bottom">
      <button className={`btn navbar-button navbar-button--${classSuffix}`} onClick={onClick}>
        <i className={icon} />
      </button>
    </Tooltip>
  );
};
