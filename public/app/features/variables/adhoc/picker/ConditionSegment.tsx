import React from 'react';

interface Props {
  label: string;
}

export const ConditionSegment = ({ label }: Props) => {
  return (
    <div className="gf-form">
      <span className="gf-form-label query-keyword">{label}</span>
    </div>
  );
};
