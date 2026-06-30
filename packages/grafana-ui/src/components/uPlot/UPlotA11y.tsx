import { memo, useMemo, useState } from 'react';

import { type DataFrame, type Field, formattedValueToString, getFieldDisplayName } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';

// Keep the rendered DOM bounded: rather than building a cell per value up front (expensive for large
// data), we only render/format the current page. Tables paginate by row, the frame set by table.
export const ROWS_PER_PAGE = 25;
export const FRAMES_PER_PAGE = 5;

interface Props {
  // The post-transform source DataFrames — the same data a "Table view" would render, so the
  // table is correct for every visualization regardless of its uPlot data shape.
  frames?: DataFrame[];
  id: string;
}

export const UPlotA11y = memo(({ frames, id }: Props) => {
  const [framePage, setFramePage] = useState(0);

  // Skip frames with no rows/fields (e.g. an empty series) so they don't render an empty table.
  const validFrames = useMemo(
    () => (frames ?? []).filter((frame) => frame.length > 0 && frame.fields.length > 0),
    [frames]
  );

  if (validFrames.length === 0) {
    return (
      <div className="sr-only" id={id} data-testid="uplot-a11y">
        <Trans i18nKey="grafana-ui.uplot-a11y.no-data">Chart has no data to display.</Trans>
      </div>
    );
  }

  const pageCount = Math.max(1, Math.ceil(validFrames.length / FRAMES_PER_PAGE));
  const currentPage = Math.min(framePage, pageCount - 1);
  const start = currentPage * FRAMES_PER_PAGE;
  const visibleFrames = validFrames.slice(start, start + FRAMES_PER_PAGE);

  return (
    <div className="sr-only" id={id} data-testid="uplot-a11y">
      {visibleFrames.map((frame, i) => (
        <FrameA11yTable key={start + i} frame={frame} allFrames={validFrames} />
      ))}
      {pageCount > 1 && (
        <Paginator
          page={currentPage}
          pageCount={pageCount}
          onChange={setFramePage}
          label={t('grafana-ui.uplot-a11y.frame-pagination-label', 'Data tables')}
        />
      )}
    </div>
  );
});

UPlotA11y.displayName = 'UPlotA11y';

interface FrameA11yTableProps {
  frame: DataFrame;
  allFrames: DataFrame[];
}

function FrameA11yTable({ frame, allFrames }: FrameA11yTableProps) {
  const [rowPage, setRowPage] = useState(0);

  const headers = useMemo(
    () => frame.fields.map((field) => getFieldDisplayName(field, frame, allFrames)),
    [frame, allFrames]
  );

  const pageCount = Math.max(1, Math.ceil(frame.length / ROWS_PER_PAGE));
  const currentPage = Math.min(rowPage, pageCount - 1);
  const start = currentPage * ROWS_PER_PAGE;
  const end = Math.min(start + ROWS_PER_PAGE, frame.length);

  const rows = useMemo(() => {
    const out: string[][] = [];
    for (let row = start; row < end; row++) {
      out.push(frame.fields.map((field) => formatValue(field, row)));
    }
    return out;
  }, [frame, start, end]);

  const caption = frame.name ?? frame.refId ?? '';

  return (
    <div>
      <table>
        {caption !== '' && <caption>{caption}</caption>}
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={start + rowIdx}>
              {row.map((cell, cellIdx) => (
                <td key={cellIdx}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {pageCount > 1 && (
        <Paginator
          page={currentPage}
          pageCount={pageCount}
          onChange={setRowPage}
          label={t('grafana-ui.uplot-a11y.row-pagination-label', 'Table rows')}
        />
      )}
    </div>
  );
}

interface PaginatorProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  label: string;
}

function Paginator({ page, pageCount, onChange, label }: PaginatorProps) {
  return (
    <div role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 0}>
        <Trans i18nKey="grafana-ui.uplot-a11y.previous-page">Previous page</Trans>
      </button>
      <span>
        <Trans i18nKey="grafana-ui.uplot-a11y.page-indicator" values={{ currentPage: page + 1, totalPages: pageCount }}>
          Page {'{{currentPage}}'} of {'{{totalPages}}'}
        </Trans>
      </span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pageCount - 1}>
        <Trans i18nKey="grafana-ui.uplot-a11y.next-page">Next page</Trans>
      </button>
    </div>
  );
}

function formatValue(field: Field, row: number): string {
  const value = field.values[row];
  if (field.display != null) {
    return formattedValueToString(field.display(value));
  }
  return value == null ? '' : String(value);
}
