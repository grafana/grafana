import { css } from '@emotion/css';
import clsx from 'clsx';
import { ReactNode, useMemo } from 'react';

import { GrafanaTheme2, Field, fieldReducers, ReducerID } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableFooterOptions } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { TABLE } from '../constants';
import { useReducerEntries } from '../hooks';
import { getDefaultCellStyles } from '../styles';
import { TableRow } from '../types';
import { getDisplayName, getJustifyContent, TextAlign } from '../utils';

interface SummaryCellProps {
  rows: TableRow[];
  field: Field;
  footers: Array<TableFooterOptions | undefined>;
  textAlign: TextAlign;
  colIdx: number;
  rowLabel?: boolean;
  hideLabel?: boolean;
}

const getReducerName = (reducerId: string): string => {
  if (reducerId === ReducerID.countAll) {
    return t('grafana-ui.table.footer.reducer.count', 'Count');
  }
  return fieldReducers.get(reducerId)?.name || reducerId;
};

export const SummaryCell = ({
  rows,
  footers,
  field,
  colIdx,
  hideLabel = false,
  rowLabel = false,
  textAlign,
}: SummaryCellProps) => {
  const styles = useStyles2(getStyles, textAlign, hideLabel);
  const theme = useTheme2();

  const reducerResultsEntries = useReducerEntries(field, rows, getDisplayName(field), colIdx);
  const entries = useMemo<Array<[string, string | null]>>(() => {
    // if there are reducer results, always render those.
    if (reducerResultsEntries.length > 0) {
      return reducerResultsEntries;
    }
    // if not, we may need to render the labels for a "uniform" footer where the reducers don't start in the first column.
    if (rowLabel) {
      for (const footer of footers) {
        if (footer?.reducers?.length ?? 0 > 0) {
          return footer!.reducers!.map((r) => [r, null]);
        }
      }
    }
    // otherwise, this is empty.
    return [];
  }, [reducerResultsEntries, rowLabel, footers]);

  const SummaryCellItem = ({ children, idx }: { children: ReactNode; idx: number }) => (
    <div className={clsx(styles.footerItem, { [styles.footerItemOdd]: idx % 2 === 1 })}>{children}</div>
  );
  const SummaryCellLabel = ({ children }: { children: ReactNode }) => (
    <div
      data-testid={selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel}
      className={styles.footerItemLabel}
    >
      {children}
    </div>
  );
  const SummaryCellValue = ({ children }: { children: ReactNode }) => (
    <div
      data-testid={selectors.components.Panels.Visualization.TableNG.Footer[children == null ? 'EmptyValue' : 'Value']}
      className={styles.footerItemValue}
    >
      {children ?? <>&nbsp;</>}
    </div>
  );

  const defaultFooterCellStyles = getDefaultCellStyles(theme, {
    textAlign: 'left', // alignment is set in footerItem
    shouldOverflow: true,
    textWrap: false,
  });

  return (
    <div
      className={clsx(styles.footerCell, defaultFooterCellStyles)}
      data-testid={entries.length === 0 ? 'summary-cell-empty' : undefined}
    >
      {entries.map(([reducerId, reducerResult], idx) => {
        return (
          <SummaryCellItem key={reducerId} idx={idx}>
            {((!hideLabel && reducerResult != null) || rowLabel) && (
              <SummaryCellLabel>{getReducerName(reducerId)}</SummaryCellLabel>
            )}
            <SummaryCellValue>{reducerResult}</SummaryCellValue>
          </SummaryCellItem>
        );
      })}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2, textAlign: TextAlign, hideLabel: boolean) => ({
  footerCell: css({
    flexDirection: 'column',
    minHeight: '100%',
    width: '100%',
  }),
  footerItem: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: hideLabel ? getJustifyContent(textAlign) : 'space-between',
    alignItems: 'flex-start',
    width: '100%',
    gap: theme.spacing(0.5),
    paddingBlock: TABLE.FOOTER_PADDING,
    paddingInline: TABLE.CELL_PADDING,
  }),
  footerItemOdd: css({
    backgroundColor: theme.colors.background.secondary,
  }),
  footerItemLabel: css({
    flexShrink: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightLight,
    textTransform: 'uppercase',
    lineHeight: '22px',
  }),
  footerItemValue: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
