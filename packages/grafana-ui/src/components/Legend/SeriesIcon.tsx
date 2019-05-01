import React from 'react';

export const SeriesIcon: React.FunctionComponent<{ color: string }> = ({ color }) => {
  return <i className="fa fa-minus pointer" style={{ color }} />;
};
