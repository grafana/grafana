import { memo, useMemo } from 'react';

import { type DataFrame, formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { Trans } from '@grafana/i18n';

// Guardrails for the screen-reader-only table. Rendering a cell per value gets expensive fast, so
// we bail out entirely (rather than truncate) once a frame set exceeds these bounds.
export const MAX_FIELDS_A11Y_TABLE = 25;
export const MAX_ROWS_A11Y_TABLE = 500;

interface Props {
  // The post-transform source DataFrames — the same data a "Table view" would render, so the
  // table is correct for every visualization regardless of its uPlot data shape.
  frames?: DataFrame[];
  id: string;
}

interface A11yTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

type A11yModel = A11yTable[] | 'no-data' | 'too-large';

export const UPlotA11y = memo(({ frames, id }: Props) => {
  const model = useMemo(() => buildA11yModel(frames), [frames]);

  if (model === 'no-data') {
    return (
      <div className="sr-only" id={id}>
        <Trans i18nKey="grafana-ui.uplot-a11y.no-data">Chart has no data to display.</Trans>
      </div>
    );
  }

  if (model === 'too-large') {
    return (
      <div className="sr-only" id={id}>
        <Trans i18nKey="grafana-ui.uplot-a11y.too-large">
          Chart has too much data to display in a table for accessibility.
        </Trans>
      </div>
    );
  }

  return (
    <div className="sr-only" id={id}>
      {model.map((table, tableIdx) => (
        <table key={tableIdx}>
          {table.caption && <caption>{table.caption}</caption>}
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {row.map((cell, cellIdx) => (
                  <td key={cellIdx}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  );
});

UPlotA11y.displayName = 'UPlotA11y';

function buildA11yModel(frames?: DataFrame[]): A11yModel {
  if (frames == null || frames.length === 0 || frames.every((f) => f.length === 0 || f.fields.length === 0)) {
    return 'no-data';
  }

  const totalFields = frames.reduce((sum, frame) => sum + frame.fields.length, 0);
  const totalRows = frames.reduce((sum, frame) => sum + frame.length, 0);

  if (totalFields > MAX_FIELDS_A11Y_TABLE || totalRows > MAX_ROWS_A11Y_TABLE) {
    return 'too-large';
  }

  return frames.map((frame) => {
    const headers = frame.fields.map((field) => getFieldDisplayName(field, frame, frames));
    const rows: string[][] = [];

    for (let row = 0; row < frame.length; row++) {
      rows.push(
        frame.fields.map((field) => {
          const value = field.values[row];
          if (field.display != null) {
            return formattedValueToString(field.display(value));
          }
          return value == null ? '' : String(value);
        })
      );
    }

    return { caption: frame.name ?? frame.refId ?? '', headers, rows };
  });
}
