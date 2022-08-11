import { screen, getAllByRole } from '@testing-library/react';

export function getLabelSelects(index = 0) {
  const labels = screen.getByText(/Label filters/);
  const selects = getAllByRole(labels.parentElement!.parentElement!.parentElement!, 'combobox');
  return {
    name: selects[3 * index],
    value: selects[3 * index + 2],
  };
}
