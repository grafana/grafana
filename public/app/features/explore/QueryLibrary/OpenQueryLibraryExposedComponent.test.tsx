import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DataQuery } from '@grafana/schema';

import { OpenQueryLibraryExposedComponent } from './OpenQueryLibraryExposedComponent';
import { QueryLibraryContextType, useQueryLibraryContext } from './QueryLibraryContext';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

jest.mock('./QueryLibraryContext', () => ({
  useQueryLibraryContext: jest.fn(),
}));

const mockUseQueryLibraryContext = useQueryLibraryContext as jest.MockedFunction<typeof useQueryLibraryContext>;

describe('OpenQueryLibraryExposedComponent', () => {
  const mockOpenDrawer = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryLibraryContext.mockReturnValue({
      openDrawer: mockOpenDrawer,
      queryLibraryEnabled: true,
    } as unknown as QueryLibraryContextType);
  });

  it('renders a toolbar button when query library is enabled', () => {
    render(<OpenQueryLibraryExposedComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('returns null and logs warning when query library is disabled', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    mockUseQueryLibraryContext.mockReturnValue({
      openDrawer: mockOpenDrawer,
      queryLibraryEnabled: false,
    } as unknown as QueryLibraryContextType);

    const { container } = render(<OpenQueryLibraryExposedComponent />);
    expect(container.firstChild).toBeNull();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      '[OpenQueryLibraryExposedComponent]: Attempted to use unsupported exposed component. Query library is not enabled.'
    );

    consoleWarnSpy.mockRestore();
  });

  it('renders button with custom icon prop', () => {
    render(<OpenQueryLibraryExposedComponent icon="folder-open" />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders button with default icon prop', () => {
    render(<OpenQueryLibraryExposedComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('renders with custom tooltip', () => {
    render(<OpenQueryLibraryExposedComponent tooltip="Custom tooltip" />);
    expect(screen.getByLabelText('Custom tooltip')).toBeInTheDocument();
  });

  it('calls openDrawer to save a query', async () => {
    const mockQuery: DataQuery = { refId: 'A' };
    const mockDatasourceFilters = ['loki'];

    render(
      <OpenQueryLibraryExposedComponent
        query={mockQuery}
        datasourceFilters={mockDatasourceFilters}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    expect(mockOpenDrawer).toHaveBeenCalledWith({
      datasourceFilters: mockDatasourceFilters,
      onSelectQuery: undefined,
      query: mockQuery,
    });
  });

  it('calls openDrawer to load a query', async () => {
    const mockDatasourceFilters = ['loki'];
    const mockOnSelectQuery = jest.fn();

    render(
      <OpenQueryLibraryExposedComponent
        datasourceFilters={mockDatasourceFilters}
        onSelectQuery={mockOnSelectQuery}
      />
    );

    await userEvent.click(screen.getByRole('button'));

    expect(mockOpenDrawer).toHaveBeenCalledWith({
      datasourceFilters: mockDatasourceFilters,
      onSelectQuery: mockOnSelectQuery,
      query: undefined,
    });
  });

  it('opens the drawer when no arguments are provided', async () => {
    render(<OpenQueryLibraryExposedComponent />);

    await userEvent.click(screen.getByRole('button'));

    expect(mockOpenDrawer).toHaveBeenCalledWith({
      datasourceFilters: undefined,
      onSelectQuery: undefined,
      query: undefined,
    });
  });
});
