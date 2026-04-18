import { screen, render } from '@testing-library/react';

import { TableCellInspector, TableCellInspectorMode } from './TableCellInspector';

describe('TableCellInspector', () => {
  it.each([
    { type: 'string', value: 'simple string' },
    { type: 'number', value: 12345 },
    { type: 'object', value: { key: 'value', anotherKey: 42 } },
    { type: 'array', value: [1, 2, 3, 4, 5] },
    { type: 'null', value: null },
    { type: 'undefined', value: undefined },
  ])('should successfully render for input of type $type', ({ value }) => {
    render(<TableCellInspector value={value} onDismiss={() => {}} mode={TableCellInspectorMode.text} />);
    expect(screen.getByText('Copy to Clipboard')).toBeInTheDocument();
  });
});
