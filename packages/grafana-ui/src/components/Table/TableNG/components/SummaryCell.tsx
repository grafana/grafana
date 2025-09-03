import { css } from '@emotion/css';
import clsx from 'clsx';
import { CSSProperties, ReactNode, useMemo } from 'react';

import {
  GrafanaTheme2,
  Field,
  FieldState,
  FieldType,
  reduceField,
  fieldReducers,
  formattedValueToString,
  ReducerID,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { TableFooterOptions } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { getDefaultCellStyles } from '../styles';
import { TableRow } from '../types';
import { getDisplayName, TextAlign } from '../utils';

interface SummaryCellProps {
  rows: TableRow[];
  field: Field;
  footers: Array<TableFooterOptions | undefined>;
  textAlign: TextAlign;
  omitCountAll?: boolean;
  rowLabel?: boolean;
  hideLabel?: boolean;
  justifyContent?: CSSProperties['justifyContent'];
}

export interface ReducerResult {
  value: number | null;
  formattedValue: string;
  reducerName: string;
}

interface FooterFieldState extends FieldState {
  lastProcessedRowCount: number;
}

const isReducer = (maybeReducer: string): maybeReducer is ReducerID => maybeReducer in ReducerID;
const getReducerName = (reducerId: string): string => {
  if (reducerId === ReducerID.countAll) {
    return t('grafana-ui.table.footer.reducer.count', 'Count');
  }
  return fieldReducers.get(reducerId)?.name || reducerId;
};

const nonMathReducers = new Set<ReducerID>([
  ReducerID.allValues,
  ReducerID.changeCount,
  ReducerID.count,
  ReducerID.countAll,
  ReducerID.distinctCount,
  ReducerID.first,
  ReducerID.firstNotNull,
  ReducerID.last,
  ReducerID.lastNotNull,
  ReducerID.uniqueValues,
]);
const isNonMathReducer = (reducer: string) => isReducer(reducer) && nonMathReducers.has(reducer);

const noFormattingReducers = new Set<ReducerID>([ReducerID.count, ReducerID.countAll]);
const shouldReducerSkipFormatting = (reducer: string) => isReducer(reducer) && noFormattingReducers.has(reducer);

export const useReducerEntries = (
  field: Field,
  rows: TableRow[],
  displayName: string
): Array<[string, ReducerResult | null]> => {
  return useMemo<Array<[string, ReducerResult | null]>>(() => {
    const reducers: string[] = field.config.custom?.footer?.reducers ?? [];

    if (
      reducers.length === 0 ||
      (field.type !== FieldType.number && reducers.every((reducerId) => !isNonMathReducer(reducerId)))
    ) {
      return [];
    }

    // Create a new state object that matches the original behavior exactly
    const newState: FooterFieldState = {
      lastProcessedRowCount: 0,
      ...(field.state || {}), // Preserve any existing state properties
    };

    // Assign back to field
    field.state = newState;

    const currentRowCount = rows.length;
    const lastRowCount = newState.lastProcessedRowCount;

    // Check if we need to invalidate the cache
    if (lastRowCount !== currentRowCount) {
      // Cache should be invalidated as row count has changed
      if (newState.calcs) {
        delete newState.calcs;
      }
      // Update the row count tracker
      newState.lastProcessedRowCount = currentRowCount;
    }

    // Calculate all specified reducers
    const results: Record<string, number | null> = reduceField({
      field: {
        ...field,
        values: rows.map((row) => row[displayName]),
      },
      reducers,
    });

    return reducers.map((reducerId) => {
      // For number fields, show all reducers
      // For non-number fields, only show special count reducers
      if (results[reducerId] === undefined || (field.type !== FieldType.number && !isNonMathReducer(reducerId))) {
        return [reducerId, null];
      }

      const value = results[reducerId];
      const reducerName = getReducerName(reducerId);
      const formattedValue =
        field.display && !shouldReducerSkipFormatting(reducerId)
          ? formattedValueToString(field.display(value))
          : String(value);

      return [
        reducerId,
        {
          value,
          formattedValue,
          reducerName,
        },
      ];
    });
  }, [field, rows, displayName]);
};

const SummaryCellItem = ({ children, styles }: { children: ReactNode; styles: ReturnType<typeof getStyles> }) => (
  <div className={styles.footerItem}>{children}</div>
);

const SummaryCellLabel = ({ children, styles }: { children: ReactNode; styles: ReturnType<typeof getStyles> }) => (
  <div
    data-testid={selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel}
    className={styles.footerItemLabel}
  >
    {children}
  </div>
);

const SummaryCellValue = ({ children, styles }: { children: ReactNode; styles: ReturnType<typeof getStyles> }) => (
  <div data-testid={selectors.components.Panels.Visualization.TableNG.Footer.Value} className={styles.footerItemValue}>
    {children}
  </div>
);

export const SummaryCell = ({
  rows,
  footers,
  field,
  omitCountAll = false,
  hideLabel = false,
  rowLabel = false,
  textAlign,
}: SummaryCellProps) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const defaultFooterCellStyles = getDefaultCellStyles(theme, {
    textAlign,
    shouldOverflow: true,
    textWrap: false,
  });
  const displayName = getDisplayName(field);
  const reducerResultsEntries = useReducerEntries(field, rows, displayName);
  const cellClass = clsx(styles.footerCell, defaultFooterCellStyles);

  // Render each reducer in the footer
  return (
    <div className={cellClass}>
      {reducerResultsEntries.map(([reducerId, reducerResultEntry]) => {
        const isCountAll = reducerId === ReducerID.countAll;

        // empty reducer entry, but there may be more after - render a spacer.
        if ((isCountAll && omitCountAll) || reducerResultEntry === null) {
          return (
            <SummaryCellItem styles={styles} key={reducerId}>
              &nbsp;
            </SummaryCellItem>
          );
        }

        const { reducerName, formattedValue } = reducerResultEntry;

        return (
          <SummaryCellItem key={reducerId} styles={styles}>
            {!hideLabel && <SummaryCellLabel styles={styles}>{reducerName}</SummaryCellLabel>}
            <SummaryCellValue styles={styles}>{formattedValue}</SummaryCellValue>
          </SummaryCellItem>
        );
      })}
      {reducerResultsEntries.length === 0 &&
        (rowLabel && footers.some((f) => f) ? (
          <div className={cellClass}>
            {footers
              .find((f) => (f?.reducers?.length ?? 0) > 0)
              ?.reducers?.map((reducerId) => {
                const reducerName = getReducerName(reducerId);
                return (
                  <SummaryCellItem styles={styles} key={reducerId}>
                    <SummaryCellLabel styles={styles}>{reducerName}</SummaryCellLabel>
                  </SummaryCellItem>
                );
              })}
          </div>
        ) : (
          <div data-testid="summary-cell-empty" className={cellClass} />
        ))}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  footerCell: css({
    flexDirection: 'column',
    minHeight: '100%',
  }),
  footerItem: css({
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    width: '100%',
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
  }),
  footerItemValue: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
