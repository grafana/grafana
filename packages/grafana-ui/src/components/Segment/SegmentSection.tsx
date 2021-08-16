import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { SegmentSectionFill } from './SegmentSectionFill';
import { SegmentSectionLabel } from './SegmentSectionLabel';
import { useStyles2 } from '../../themes';

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
}) => {
  const styles = useStyles2(getStyles);
  return (
    <>
      <div className={styles.container}>
        <div>
          <SegmentSectionLabel name={label} className="width-7" />
        </div>
        {children}
        {fill && <SegmentSectionFill />}
      </div>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    display: flex;
    flex-wrap: wrap;
    row-gap: ${theme.spacing(0.5)};
    align-content: flex-start;
  `,
});
