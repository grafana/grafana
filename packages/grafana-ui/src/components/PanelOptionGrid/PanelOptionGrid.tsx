import React, { SFC } from 'react';

interface Props {
  cols?: number;
  children: JSX.Element[] | JSX.Element;
}

export const PanelOptionGrid: SFC<Props> = ({ children }) => {

  return (
    <div className="panel-option-grid">
      {children}
    </div>
  );
};
