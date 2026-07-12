import { AppEvents, type DataFrame } from '@grafana/data';
import { appEvents } from 'app/core/app_events';

/**
 * Returns a copy of `dataFrame` containing only the rows at `rowIndexes`, in the given order.
 * Used so CSV export from Inspect can reflect column filters/sorting currently applied in the data preview table.
 * Returns `dataFrame` unchanged if `rowIndexes` is undefined.
 */
export function filterDataFrameByRowIndexes(dataFrame: DataFrame, rowIndexes: number[] | undefined): DataFrame {
  if (!rowIndexes) {
    return dataFrame;
  }

  return {
    ...dataFrame,
    length: rowIndexes.length,
    fields: dataFrame.fields.map((field) => ({
      ...field,
      values: rowIndexes.map((rowIndex) => field.values[rowIndex]),
    })),
  };
}

export function getPrettyJSON(obj: unknown): string {
  let r = '';
  try {
    r = JSON.stringify(obj, getCircularReplacer(), 2);
  } catch (e) {
    if (
      e instanceof Error &&
      (e.toString().includes('RangeError') || e.toString().includes('allocation size overflow'))
    ) {
      appEvents.emit(AppEvents.alertError, [e.toString(), 'Cannot display JSON, the object is too big.']);
    } else {
      appEvents.emit(AppEvents.alertError, [e instanceof Error ? e.toString() : e]);
    }
  }
  return r;
}

function getCircularReplacer() {
  const seen = new WeakSet();

  return (key: string, value: unknown) => {
    if (key === '__dataContext' || key === '__sceneObject') {
      return 'Filtered out in JSON serialization';
    }

    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
}
