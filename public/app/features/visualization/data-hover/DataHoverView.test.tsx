import { render, screen } from '@testing-library/react';

import { arrayToDataFrame, createDataFrame, FieldType } from '@grafana/data';

import { DataHoverView, getDisplayValuesAndLinks } from './DataHoverView';
import { isHttpUrl, renderValue } from './renderValue';

jest.mock('app/plugins/panel/status-history/utils', () => ({
  getDataLinks: jest.fn().mockReturnValue([]),
}));

describe('isHttpUrl', () => {
  it.each([
    { url: 'https://example.com/path', expected: true },
    { url: 'http://localhost:3000', expected: true },
    { url: 'ftp://files.example.com', expected: false },
    { url: 'not a url', expected: false },
  ])('"$url" returns $expected', ({ url, expected }) => {
    expect(isHttpUrl(url)).toBe(expected);
  });
});

describe('renderValue', () => {
  it('returns the string unchanged for non-URL values', () => {
    expect(renderValue('hello world')).toBe('hello world');
  });

  it('renders an anchor element for http URLs', () => {
    render(<>{renderValue('http://example.com')}</>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'http://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveTextContent('http://example.com');
  });

  it('renders an anchor element for https URLs', () => {
    render(<>{renderValue('https://grafana.com')}</>);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://grafana.com');
  });
});

describe('getDisplayValuesAndLinks', () => {
  it('returns null when all fields are hidden from tooltip', () => {
    const data = createDataFrame({
      fields: [{ name: 'value', type: FieldType.number, values: [42], config: { custom: { hideFrom: { tooltip: true } } } }],
    });
    expect(getDisplayValuesAndLinks(data, 0)).toBeNull();
  });

  it('returns displayValues for all visible fields', () => {
    const data = arrayToDataFrame([{ name: 'Alice', age: 30 }]);
    const result = getDisplayValuesAndLinks(data, 0);
    expect(result).not.toBeNull();
    expect(result!.displayValues).toHaveLength(2);
    expect(result!.displayValues[0].value).toBe('Alice');
    expect(result!.displayValues[1].value).toBe(30);
  });

  it('filters to specific column when columnIndex is provided', () => {
    const data = arrayToDataFrame([{ name: 'Alice', age: 30 }]);
    const result = getDisplayValuesAndLinks(data, 0, 1);
    expect(result).not.toBeNull();
    expect(result!.displayValues).toHaveLength(1);
    expect(result!.displayValues[0].value).toBe(30);
  });

  it('returns null when columnIndex points to a hidden field', () => {
    const data = createDataFrame({
      fields: [
        { name: 'visible', type: FieldType.string, values: ['x'] },
        { name: 'hidden', type: FieldType.number, values: [1], config: { custom: { hideFrom: { tooltip: true } } } },
      ],
    });
    expect(getDisplayValuesAndLinks(data, 0, 1)).toBeNull();
  });

  it('deduplicates links with the same title and href across fields', () => {
    const { getDataLinks } = jest.requireMock('app/plugins/panel/status-history/utils');
    const sharedLink = { title: 'Dashboard', href: 'https://grafana.com', target: '_blank' };
    getDataLinks.mockReturnValue([sharedLink]);

    const data = arrayToDataFrame([{ a: 1, b: 2 }]);
    const result = getDisplayValuesAndLinks(data, 0);
    expect(result!.links).toHaveLength(1);

    getDataLinks.mockReturnValue([]);
  });
});

describe('DataHoverView component', () => {
  it('renders field values', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    render(<DataHoverView data={data} rowIndex={0} />);
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('returns null when data is undefined', () => {
    const { container } = render(<DataHoverView rowIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when rowIndex is null', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    const { container } = render(<DataHoverView data={data} rowIndex={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders header when provided', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    render(<DataHoverView data={data} rowIndex={0} header="My Header" />);
    expect(screen.getByText('My Header')).toBeInTheDocument();
  });

  it('does not render header when not provided', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    render(<DataHoverView data={data} rowIndex={0} />);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('returns null when all fields are hidden from tooltip', () => {
    const data = createDataFrame({
      fields: [{ name: 'hidden', type: FieldType.string, values: ['x'], config: { custom: { hideFrom: { tooltip: true } } } }],
    });
    const { container } = render(<DataHoverView data={data} rowIndex={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders all visible fields regardless of columnIndex (columnIndex is not used by this component)', () => {
    const data = arrayToDataFrame([{ name: 'Alice', age: 30 }]);
    render(<DataHoverView data={data} rowIndex={0} columnIndex={1} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });
});
