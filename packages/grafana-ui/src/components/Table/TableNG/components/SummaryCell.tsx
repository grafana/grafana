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
  const defaultFooterCellStyles = getDefaultCellStyles(theme, {
    textAlign: 'left', // alignment is set in footerItem
    shouldOverflow: true,
    textWrap: false,
  });
  const displayName = getDisplayName(field);
  const reducerResultsEntries = useReducerEntries(field, rows, displayName, colIdx);
  const cellClass = clsx(styles.footerCell, defaultFooterCellStyles);
  const firstFooterReducers = useMemo(() => {
    for (const footer of footers) {
      if (footer?.reducers?.length ?? 0 > 0) {
        return footer!.reducers!;
      }
    }
    return;
  }, [footers]);
  const renderRowLabel = rowLabel && reducerResultsEntries.length === 0 && Boolean(firstFooterReducers);

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
      data-testid={selectors.components.Panels.Visualization.TableNG.Footer.Value}
      className={styles.footerItemValue}
    >
      {children}
    </div>
  );

  // Render each reducer in the footer
  return (
    <div
      className={cellClass}
      data-testid={reducerResultsEntries.length === 0 && !renderRowLabel ? 'summary-cell-empty' : undefined}
    >
      {reducerResultsEntries.map(([reducerId, reducerResult], idx) => {
        return (
          <SummaryCellItem key={reducerId} idx={idx}>
            {((!hideLabel && reducerResult != null) || rowLabel) && (
              <SummaryCellLabel>{getReducerName(reducerId)}</SummaryCellLabel>
            )}
            <SummaryCellValue>{reducerResult ?? <>&nbsp;</>}</SummaryCellValue>
          </SummaryCellItem>
        );
      })}

      {renderRowLabel &&
        firstFooterReducers!.map((reducerId, idx) => (
          <SummaryCellItem key={reducerId} idx={idx}>
            <SummaryCellLabel>{getReducerName(reducerId)}</SummaryCellLabel>
          </SummaryCellItem>
        ))}
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
