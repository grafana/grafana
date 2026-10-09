/* eslint-disable jest-dom/prefer-to-have-text-content -- Assert exact text, including JSON whitespace, rather than a substring. */
import { render, screen, waitFor } from '@testing-library/react';

import { createDataFrame, createTheme, FieldType, type Field } from '@grafana/data';
import { TableCellDisplayMode, type TableCellOptions } from '@grafana/schema';

import { type TableCellRendererProps } from '../types';

import { JsonCell } from './JsonCell';

const theme = createTheme();

const mockLoadHighlight = jest.fn();
jest.mock('./JsonSyntaxHighlight', () => {
  mockLoadHighlight();
  return jest.requireActual('./JsonSyntaxHighlight');
});

function props(text: string, overrides: Partial<TableCellRendererProps> = {}): TableCellRendererProps {
  const field: Field = {
    name: 'JSON',
    type: FieldType.string,
    values: [text],
    config: {},
    display: () => ({ text, numeric: NaN }),
  };
  return {
    field,
    frame: createDataFrame({ fields: [field] }),
    value: text,
    rowIdx: 0,
    height: 30,
    width: 300,
    theme,
    cellOptions: { type: TableCellDisplayMode.JSONView },
    cellInspect: false,
    showFilters: false,
    getTextColorForBackground: () => '',
    jsonSyntaxHighlightingEnabled: true,
    ...overrides,
  };
}

it('loads highlighting only for eligible JSON and preserves text while loading', async () => {
  const { container, rerender } = render(<JsonCell {...props('not JSON: true 123')} />);
  expect(container.textContent).toBe('not JSON: true 123');
  expect(mockLoadHighlight).not.toHaveBeenCalled();

  rerender(<JsonCell {...props('{"a":true}', { jsonSyntaxHighlightingEnabled: false })} />);
  expect(container.textContent).toBe('{"a":true}');
  expect(mockLoadHighlight).not.toHaveBeenCalled();

  rerender(
    <JsonCell
      {...props('{"a":true}', { cellOptions: { type: TableCellDisplayMode.JSONView, syntaxHighlighting: false } })}
    />
  );
  expect(container.textContent).toBe('{"a":true}');
  expect(mockLoadHighlight).not.toHaveBeenCalled();

  const oversized = JSON.stringify(['a'.repeat(49_999)]);
  rerender(<JsonCell {...props(oversized)} />);
  expect(container.textContent).toBe(oversized);
  expect(mockLoadHighlight).not.toHaveBeenCalled();

  rerender(<JsonCell {...props('{"a":true}')} />);
  expect(container.textContent).toBe('{"a":true}');
  expect(await screen.findByText('true')).toHaveStyle({ color: theme.components.codeEditor.number });
  expect(mockLoadHighlight).toHaveBeenCalledTimes(1);
  expect(container.textContent).toBe('{"a":true}');
});

it.each([
  '[1, 2, 3]',
  '[1, false, null, "hello"]',
  '[]',
  '{}',
  ' \n {"a": 1} \t',
  '{"key":"<img src=x onerror=alert(1)>"}',
])('highlights valid JSON %s without changing its text', async (text) => {
  const { container } = render(<JsonCell {...props(text)} />);
  await waitFor(() => expect(container.querySelector('span[style]')).toBeInTheDocument());
  expect(container.textContent).toBe(text);
  expect(container.querySelector('img')).not.toBeInTheDocument();
});

it.each(['1', '-1.5', 'true', 'false', 'null', '"hello"', '"[1, 2, 3]"', ' \n 1 \t'])(
  'keeps top-level JSON scalar %s plain',
  (text) => {
    const { container } = render(<JsonCell {...props(text)} />);
    expect(container.textContent).toBe(text);
    expect(container.querySelector('span')).not.toBeInTheDocument();
  }
);

it.each(['plain text', '{"a":}', '{"a":true,}', '// comment\n{"a":1}', ''])('keeps invalid JSON %s plain', (text) => {
  const { container } = render(<JsonCell {...props(text)} />);
  expect(container.textContent).toBe(text);
  expect(container.querySelector('span')).not.toBeInTheDocument();
});

it('uses displayed text rather than the raw value and updates when display text changes', async () => {
  const { container, rerender } = render(<JsonCell {...props('["mapped"]', { value: '{"raw":true}' })} />);
  expect(await screen.findByText('"mapped"')).toHaveStyle({ color: theme.components.codeEditor.string });
  expect(container.textContent).toBe('["mapped"]');
  rerender(<JsonCell {...props('"mapped"', { value: '{"raw":true}' })} />);
  expect(container.textContent).toBe('"mapped"');
  expect(container.querySelector('span')).not.toBeInTheDocument();
});

it('keeps a highlighted value inside its data link', async () => {
  const cellProps = props('{"a":true}');
  cellProps.field.config.links = [{ title: 'Details', url: '/details' }];
  cellProps.field.getLinks = () => [{ title: 'Details', href: '/details', target: '_self', origin: cellProps.field }];
  render(<JsonCell {...cellProps} />);
  expect(await screen.findByText('true')).toHaveStyle({ color: theme.components.codeEditor.number });
  expect(screen.getByRole('link', { name: 'Details' })).toHaveAttribute('href', '/details');
  expect(screen.getByRole('link', { name: 'Details' })).toHaveTextContent('{"a":true}');
});

it.each<TableCellOptions>([{ type: TableCellDisplayMode.Auto }, { type: TableCellDisplayMode.JSONView }])(
  'highlights mode %o',
  async (cellOptions) => {
    render(<JsonCell {...props('{"value":42}', { cellOptions })} />);
    expect(await screen.findByText('42')).toHaveStyle({ color: theme.components.codeEditor.number });
  }
);
