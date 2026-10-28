import { render, waitFor } from '@testing-library/react';

import { createDataFrame, createTheme, FieldType } from '@grafana/data';
import { TableCellDisplayMode } from '@grafana/schema';

import { JsonCell } from './JsonCell';

const mockLoadHighlight = jest.fn();
jest.mock('./JsonSyntaxHighlight', () => {
  mockLoadHighlight();
  throw new Error('Chunk unavailable');
});

it('keeps JSON readable when the highlighting chunk fails to load', async () => {
  const text = '{"active":true}';
  const frame = createDataFrame({
    fields: [{ name: 'json', type: FieldType.string, values: [text], display: () => ({ text, numeric: NaN }) }],
  });
  const { container } = render(
    <JsonCell
      field={frame.fields[0]}
      frame={frame}
      value={text}
      rowIdx={0}
      height={32}
      width={300}
      theme={createTheme()}
      cellOptions={{ type: TableCellDisplayMode.JSONView }}
      cellInspect={false}
      showFilters={false}
      getTextColorForBackground={() => ''}
      jsonSyntaxHighlightingEnabled
    />
  );
  await waitFor(() => expect(mockLoadHighlight).toHaveBeenCalledTimes(1));
  expect(container).toHaveTextContent(text);
  expect(container.querySelector('span[style]')).not.toBeInTheDocument();
});
