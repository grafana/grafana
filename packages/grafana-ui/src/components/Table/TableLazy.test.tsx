import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { applyFieldOverrides, createTheme, FieldType, toDataFrame } from '@grafana/data';

import { Table } from './Table';

function makeData(value: string) {
  return applyFieldOverrides({
    data: [toDataFrame({ fields: [{ name: 'Country', type: FieldType.string, values: [value] }] })],
    fieldConfig: { defaults: {}, overrides: [] },
    replaceVariables: (value) => value,
    timeZone: 'utc',
    theme: createTheme(),
  })[0];
}

it('uses the latest data and forwards sorting callbacks through the lazy boundary', async () => {
  const user = userEvent.setup();
  const onSortByChange = jest.fn();
  const props = { width: 800, height: 600, onSortByChange };
  const { rerender } = render(<Table {...props} data={makeData('Sweden')} />);
  rerender(<Table {...props} data={makeData('Belgium')} />);

  expect(await screen.findByText('Belgium')).toBeInTheDocument();
  expect(screen.queryByText('Sweden')).not.toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Sort by column Country' }));
  expect(onSortByChange).toHaveBeenCalledWith([{ displayName: 'Country', desc: false }]);

  rerender(<Table {...props} data={makeData('France')} />);
  expect(screen.getByText('France')).toBeInTheDocument();
});
