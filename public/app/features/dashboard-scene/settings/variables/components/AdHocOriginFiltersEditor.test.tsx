import { render, screen } from '@testing-library/react';

import { AdHocFiltersController } from '@grafana/scenes';

import { AdHocOriginFiltersEditor } from './AdHocOriginFiltersEditor';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    AdHocFiltersComboboxRenderer: ({ controller }: { controller: unknown }) => (
      <div data-testid="adhoc-combobox-renderer">mock combobox</div>
    ),
  };
});

function createMockController(): AdHocFiltersController {
  return {
    useState: () => ({
      filters: [],
      allowCustomValue: true,
      supportsMultiValueOperators: false,
    }),
    getKeys: jest.fn().mockResolvedValue([]),
    getValuesFor: jest.fn().mockResolvedValue([]),
    getOperators: jest.fn().mockReturnValue([]),
    updateFilter: jest.fn(),
    updateToMatchAll: jest.fn(),
    removeFilter: jest.fn(),
    removeLastFilter: jest.fn(),
    handleComboboxBackspace: jest.fn(),
    addWip: jest.fn(),
    restoreOriginalFilter: jest.fn(),
    clearAll: jest.fn(),
  };
}

describe('AdHocOriginFiltersEditor', () => {
  it('should render the combobox renderer', () => {
    render(<AdHocOriginFiltersEditor controller={createMockController()} />);
    expect(screen.getByTestId('adhoc-combobox-renderer')).toBeInTheDocument();
  });

  it('should render with the correct test id', () => {
    render(<AdHocOriginFiltersEditor controller={createMockController()} />);
    expect(screen.getByTestId('data-testid ad-hoc filters variable origin filters')).toBeInTheDocument();
  });

  it('should render the field label', () => {
    render(<AdHocOriginFiltersEditor controller={createMockController()} />);
    expect(screen.getByText('Default filters')).toBeInTheDocument();
  });
});
