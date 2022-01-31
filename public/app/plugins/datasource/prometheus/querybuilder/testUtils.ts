import { screen, getAllByRole } from '@testing-library/react';

export function getLabelSelects(index = 0) {
  const labels = screen.getByText(/Labels/);
  const selects = getAllByRole(labels.parentElement!, 'combobox');
  return {
    name: selects[3 * index],
    value: selects[3 * index + 2],
  };
}
