/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';

import { mockBoundingClientRect, mockClientSize } from '@grafana/test-utils';

import { Harness } from './TableColumns.testUtils';

beforeAll(() => {
  mockClientSize({ width: 800, height: 600 });
  mockBoundingClientRect({ width: 800, height: 600 });
});

it('toggles reordering for the whole table without changing column visibility controls', () => {
  const { rerender } = render(<Harness />);
  expect(screen.getAllByRole('columnheader').map((header) => header.draggable)).toEqual([true, true, true]);
  expect(screen.getAllByRole('button', { name: /^Reorder / })).toHaveLength(3);
  expect(screen.getByRole('checkbox', { name: 'Hide A' })).toBeEnabled();

  rerender(<Harness reorderable={false} />);
  expect(screen.getAllByRole('columnheader').map((header) => header.draggable)).toEqual([false, false, false]);
  expect(screen.queryByRole('button', { name: /^Reorder / })).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Hide A' })).toBeEnabled();
});
