import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FieldColorEditor } from './fieldColor';

const testRegistryItems = [
  {
    id: 'foo',
    name: 'Foo',
    description: 'This option will appear in the picker',
    getCalculator: () => 'red',
  },
  {
    id: 'bar',
    name: 'Bar',
    description: 'This option will also appear in the picker',
    getCalculator: () => 'green',
  },
  {
    id: 'baz',
    name: 'Baz',
    description: 'This option will not appear in the picker',
    getCalculator: () => 'blue',
    excludeFromPicker: true,
  },
];

jest.mock('@grafana/data', () => {
  const actualData = jest.requireActual('@grafana/data');
  return {
    ...actualData,
    fieldColorModeRegistry: new actualData.Registry(() => testRegistryItems),
  };
});

describe('fieldColor', () => {
  it('filters out registry options with excludeFromPicker=true', async () => {
    render(
      <FieldColorEditor
        value={undefined}
        onChange={() => {}}
        id="test"
        data-testid="test"
        context={{ data: [] }}
        item={testRegistryItems[0]}
      />
    );
    await userEvent.type(screen.getByRole('combobox'), '{arrowdown}');
    expect(screen.getByText(/^Foo/i)).toBeInTheDocument();
    expect(screen.getByText(/^Bar/i)).toBeInTheDocument();
    expect(screen.queryByText(/^Baz/i)).not.toBeInTheDocument();
  });
});
