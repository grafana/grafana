import { css, cx } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { DynamicTable, DynamicTableProps } from './DynamicTable';

export type DynamicTableWithGuidelinesProps<T> = Omit<DynamicTableProps<T>, 'renderPrefixHeader, renderPrefixCell'>;

// DynamicTable, but renders visual guidelines on the left, for larger screen widths
export const DynamicTableWithGuidelines = <T extends object>({
  renderExpandedContent,
  ...props
}: DynamicTableWithGuidelinesProps<T>) => {
  const styles = useStyles2(getStyles);
  return (
    <DynamicTable
      renderExpandedContent={
        renderExpandedContent
          ? (item, index, items) => (
              <>
                {!(index === items.length - 1) && <div className={cx(styles.contentGuideline, styles.guideline)} />}
                {renderExpandedContent(item, index, items)}
              </>
            )
          : undefined
      }
      renderPrefixHeader={() => (
        <div className={styles.relative}>
          <div className={cx(styles.headerGuideline, styles.guideline)} />
        </div>
      )}
      renderPrefixCell={(_, index, items) => (
        <div className={styles.relative}>
          <div className={cx(styles.topGuideline, styles.guideline)} />
          {!(index === items.length - 1) && <div className={cx(styles.bottomGuideline, styles.guideline)} />}
        </div>
      )}
      {...props}
    />
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  relative: css`
    position: relative;
    height: 100%;
  `,
  guideline: css`
    left: -19px;
    border-left: 1px solid ${theme.colors.border.medium};
    position: absolute;

    ${theme.breakpoints.down('md')} {
      display: none;
    }
  `,
  topGuideline: css`
    width: 18px;
    border-bottom: 1px solid ${theme.colors.border.medium};
    top: 0;
    bottom: 50%;
  `,
  bottomGuideline: css`
    top: 50%;
    bottom: 0;
  `,
  contentGuideline: css`
    top: 0;
    bottom: 0;
    left: -49px !important;
  `,
  headerGuideline: css`
    top: -25px;
    bottom: 0;
  `,
});
