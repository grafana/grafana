import { css } from '@emotion/css';
import clsx from 'clsx';
import { CSSProperties, useMemo } from 'react';

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

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableRow } from '../types';
import { getDisplayName } from '../utils';

interface SummaryCellProps {
  rows: TableRow[];
  field: Field;
  footers: Array<TableFooterOptions | undefined>;
  omitCountAll?: boolean;
  rowLabel?: boolean;
  hideLabel?: boolean;
  textAlign: CSSProperties['textAlign'];
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
  const displayName = getDisplayName(field);

  const reducerResultsEntries = useMemo<Array<[string, ReducerResult | null]>>(() => {
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

  if (reducerResultsEntries.length === 0) {
    // if labelled and there are some footers, we will show the label for the first footer we find in the list of footers.
    if (rowLabel && footers.some((f) => f)) {
      const firstFooter = footers.find((f) => (f?.reducers?.length ?? 0) > 0);
      return (
        <div className={styles.footerCell}>
          {firstFooter?.reducers?.map((reducerId) => {
            const reducerName = getReducerName(reducerId);
            return (
              <div key={reducerId} className={styles.footerItem}>
                <div
                  data-testid={selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel}
                  className={styles.footerItemLabel}
                >
                  {reducerName}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return <div data-testid="summary-cell-empty" className={styles.footerCell} />;
  }

  // Render each reducer in the footer
  return (
    <div className={styles.footerCell}>
      {reducerResultsEntries.map(([reducerId, reducerResultEntry]) => {
        const isCountAll = reducerId === ReducerID.countAll;

        // empty reducer entry, but there may be more after - render a spacer.
        if ((isCountAll && omitCountAll) || reducerResultEntry === null) {
          return (
            <div key={reducerId} className={styles.footerItem}>
              &nbsp;
            </div>
          );
        }

        const { reducerName, formattedValue } = reducerResultEntry;

        return (
          <div key={reducerId} className={styles.footerItem}>
            {!hideLabel && (
              <div
                data-testid={selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel}
                className={styles.footerItemLabel}
              >
                {reducerName}
              </div>
            )}
            <div
              data-testid={selectors.components.Panels.Visualization.TableNG.Footer.Value}
              className={clsx(styles.footerItemValue, { [styles.footerItemAligned]: !hideLabel })}
              style={{ textAlign: !hideLabel ? textAlign : undefined }}
            >
              {formattedValue}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => ({
  footerCell: css({
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
  }),
  footerItem: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
    marginRight: theme.spacing(1),
    textTransform: 'uppercase',
    lineHeight: '22px',
  }),
  footerItemValue: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  footerItemAligned: css({
    display: 'block',
    width: '100%',
  }),
});
