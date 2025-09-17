import { render, screen } from '@testing-library/react';

import { arrayToDataFrame } from '@grafana/data';

import { DataHoverView } from './DataHoverView';

describe('DataHoverView component', () => {
  it('should default to multi mode if mode is null or undefined', () => {
    const data = arrayToDataFrame([{ foo: 'bar' }]);
    render(<DataHoverView data={data} rowIndex={0} />);

    expect(screen.queryByText('bar')).toBeInTheDocument();
  });
});
