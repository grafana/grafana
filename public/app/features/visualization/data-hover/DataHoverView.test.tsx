import { render, screen } from '@testing-library/react';

import { arrayToDataFrame } from '@grafana/data';

import { DataHoverView } from './DataHoverView';
import { isHttpUrl } from './renderValue';

describe('DataHoverView component', () => {
  it('should default to multi mode if mode is null or undefined', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    render(<DataHoverView data={data} rowIndex={0} />);

    expect(screen.queryByText('bar')).toBeInTheDocument();
  });
});

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
