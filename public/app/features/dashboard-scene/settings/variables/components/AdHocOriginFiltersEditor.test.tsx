import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type AdHocFiltersController } from '@grafana/scenes';
import { OptionsPaneReadOnlyProvider } from 'app/features/dashboard/components/PanelEditor/OptionsPaneReadOnlyContext';

import { AdHocOriginFiltersEditor } from './AdHocOriginFiltersEditor';

jest.mock('@grafana/scenes', () => {
  const actual = jest.requireActual('@grafana/scenes');
  return {
    ...actual,
    AdHocFiltersComboboxRenderer: ({
      controller,
    }: {
      controller: Pick<AdHocFiltersController, 'useState' | 'clearAll'>;
    }) => {
      const { readOnly } = controller.useState();
      return (
        <button type="button" data-testid="adhoc-combobox-renderer" onClick={() => controller.clearAll?.()}>
          {readOnly ? 'Read-only filters' : 'Add filter'}
        </button>
      );
    },
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
  it('should render the field label', () => {
    render(<AdHocOriginFiltersEditor controller={createMockController()} />);
    expect(screen.getByText('Default filters')).toBeInTheDocument();
  });

  it('lets the user change default filters when the pane is editable', async () => {
    const user = userEvent.setup();
    const controller = createMockController();

    render(<AdHocOriginFiltersEditor controller={controller} />);

    await user.click(screen.getByRole('button', { name: 'Add filter' }));

    expect(controller.clearAll).toHaveBeenCalledTimes(1);
  });

  it('marks default filters read-only and inert when the pane is read-only', () => {
    render(
      <OptionsPaneReadOnlyProvider value={true}>
        <AdHocOriginFiltersEditor controller={createMockController()} />
      </OptionsPaneReadOnlyProvider>
    );

    const filters = screen.getByTestId('adhoc-combobox-renderer');
    expect(filters).toHaveTextContent('Read-only filters');
    expect(filters.parentElement).toHaveAttribute('inert');
    expect(filters.parentElement).toHaveAttribute('disabled');
  });
});
