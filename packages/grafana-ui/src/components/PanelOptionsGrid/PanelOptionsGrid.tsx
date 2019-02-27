import React, { SFC } from 'react';

interface Props {
  cols?: number;
  children: JSX.Element[] | JSX.Element;
}

export const PanelOptionsGrid: SFC<Props> = ({ children }) => {
  return <div className="panel-options-grid">{children}</div>;
};
