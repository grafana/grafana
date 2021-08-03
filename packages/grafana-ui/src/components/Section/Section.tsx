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
}: {
  label: string;
  children: React.ReactNode;
  inline?: boolean;
}) => (
  <div className="gf-form-inline">
    <SectionLabel name={label} inline={inline} />
    {children}
    <SectionFill />
  </div>
);
