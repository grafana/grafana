import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '../../themes';
import { InlineLabel } from '../Forms/InlineLabel';
import { InlineFieldRow } from '../Forms/InlineFieldRow';

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
      <InlineFieldRow>
        <InlineLabel width={12} className={styles.label}>
          {label}
        </InlineLabel>
        {children}
        {fill && (
          <div className={styles.fill}>
            <InlineLabel>{''}</InlineLabel>
          </div>
        )}
      </InlineFieldRow>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  label: css`
    color: ${theme.colors.primary.text};
  `,
  fill: css`
    flex-grow: 1;
    margin-bottom: ${theme.spacing(0.5)};
  `,
});
