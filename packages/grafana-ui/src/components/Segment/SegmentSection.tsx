import React from 'react';
import { SegmentSectionFill } from './SegmentSectionFill';
import { SegmentSectionLabel } from './SegmentSectionLabel';

/**
 * Horizontal section for editor components.
 *
 * @alpha
 */
export const SegmentSection = ({
  label,
  children,
  fill,
}: {
  // Name of the section
  label: string;
  // List of components in the section
  children: React.ReactNode;
  // Fill the space at the end
  fill?: boolean;
}) => (
  <div className="gf-form-inline">
    <div className="gf-form">
      <SegmentSectionLabel name={label} className="width-7" />
      {children}
    </div>
    {fill && <SegmentSectionFill />}
  </div>
);
