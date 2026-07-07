import { render, screen } from '@testing-library/react';

import { TableNG } from './TableNG';
import { type TableNGProps } from './types';

jest.mock('./legacy/LegacyTableNG', () => ({
  LegacyTableNG: () => <div data-testid="legacy-table" />,
}));
jest.mock('./refactored/RefactoredTableNG', () => ({
  RefactoredTableNG: () => <div data-testid="refactored-table" />,
}));

const baseProps = (overrides: Partial<TableNGProps>): TableNGProps =>
  ({ width: 100, height: 100, ...overrides }) as TableNGProps;

describe('TableNG dispatcher', () => {
  it('renders the refactored implementation when nestedRefactorEnabled is true', () => {
    render(<TableNG {...baseProps({ nestedRefactorEnabled: true })} />);
    expect(screen.getByTestId('refactored-table')).toBeInTheDocument();
    expect(screen.queryByTestId('legacy-table')).not.toBeInTheDocument();
  });

  it.each([false, undefined])('renders the legacy implementation when nestedRefactorEnabled is %s', (value) => {
    render(<TableNG {...baseProps({ nestedRefactorEnabled: value })} />);
    expect(screen.getByTestId('legacy-table')).toBeInTheDocument();
    expect(screen.queryByTestId('refactored-table')).not.toBeInTheDocument();
  });
});
