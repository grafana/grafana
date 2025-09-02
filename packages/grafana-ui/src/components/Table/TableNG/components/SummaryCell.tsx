import { css, cx } from '@emotion/css';
import { useMemo } from 'react';

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

import { useStyles2 } from '../../../../themes/ThemeContext';
import { TableRow } from '../types';
import { getDisplayName } from '../utils';

interface SummaryCellProps {
  rows: TableRow[];
  field: Field;
  omitCountAll?: boolean;
}

export interface ReducerResult {
  value: number | null;
  formattedValue: string;
  reducerName: string;
}

interface FooterFieldState extends FieldState {
  lastProcessedRowCount: number;
}

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
const isNonMathReducer = (reducer: ReducerID) => nonMathReducers.has(reducer);

const noFormattingReducers = new Set<ReducerID>([ReducerID.count, ReducerID.countAll]);
const shouldReducerSkipFormatting = (reducer: ReducerID) => noFormattingReducers.has(reducer);

export const SummaryCell = ({ rows, field, omitCountAll = false }: SummaryCellProps) => {
  const styles = useStyles2(getStyles);
  const displayName = getDisplayName(field);

  const reducerResultsEntries = useMemo<Array<[string, ReducerResult | null]>>(() => {
    const reducers: ReducerID[] = field.config.custom?.footer?.reducer ?? [];

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
    const results: Record<ReducerID, number | null> = reduceField({
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
      const reducerName = fieldReducers.get(reducerId)?.name || reducerId;
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

  const isSingleSumReducer = useMemo(
    () => reducerResultsEntries.every(([item]) => item === 'sum'),
    [reducerResultsEntries]
  );

  if (reducerResultsEntries.length === 0) {
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

        const canonicalReducerName = isCountAll ? t('grafana-ui.table.footer.reducer.count', 'Count') : reducerName;

        return (
          <div key={reducerId} className={cx(styles.footerItem, isSingleSumReducer && styles.sumReducer)}>
            {!isSingleSumReducer && (
              <div
                data-testid={selectors.components.Panels.Visualization.TableNG.Footer.ReducerLabel}
                className={styles.footerItemLabel}
              >
                {canonicalReducerName}
              </div>
            )}
            <div
              data-testid={selectors.components.Panels.Visualization.TableNG.Footer.Value}
              className={styles.footerItemValue}
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
    // Handle overflow reducer name collision with footer item value
    maxWidth: '75%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightLight,
    marginRight: theme.spacing(1),
    textTransform: 'uppercase',
  }),
  footerItemValue: css({
    maxWidth: '75%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.fontWeightMedium,
  }),
  sumReducer: css({
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'end',
    width: '100%',
  }),
});
