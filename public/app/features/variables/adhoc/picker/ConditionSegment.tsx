import React, { FC } from 'react';

interface Props {
  label: string;
}

export const ConditionSegment: FC<Props> = ({ label }) => {
  return (
    <div className="gf-form" data-wtf="condition-segment">
      <span className="gf-form-label query-keyword">{label}</span>
    </div>
  );
};
