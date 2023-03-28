import React, { FC } from 'react';

interface Props {
  label: string;
}

export const ConditionSegment: FC<Props> = ({ label }) => {
  return (
    <div className="gf-form">
      <span className="gf-form-label query-keyword">{label}</span>
    </div>
  );
};
