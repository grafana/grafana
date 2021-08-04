import React from 'react';
import { SectionFill } from './SectionFill';
import { SectionLabel } from './SectionLabel';

/**
 * @alpha
 */
export const Section = ({
  label,
  children,
  inline,
  fill,
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
  fill?: boolean;
}) => (
  <div className="gf-form-inline">
    <div className="gf-form">
      <SectionLabel name={label} inline={inline} />
      {children}
    </div>
    {fill && <SectionFill />}
  </div>
);
