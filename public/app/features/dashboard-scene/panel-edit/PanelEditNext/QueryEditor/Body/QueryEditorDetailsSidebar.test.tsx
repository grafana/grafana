import { fireEvent, render, screen } from '@testing-library/react';

import { PanelData } from '@grafana/data';
import { VizPanel } from '@grafana/scenes';
import { QueryGroupOptions } from 'app/types/query';

import { QueryEditorType } from '../../constants';
import { QueryOptionsState, QueryEditorProvider } from '../QueryEditorContext';
import { ds1SettingsMock, mockActions, mockOptions } from '../testUtils';

import { QueryEditorDetailsSidebar } from './QueryEditorDetailsSidebar';

describe('QueryEditorDetailsSidebar', () => {
  const mockSetIsQueryOptionsOpen = jest.fn();

  const defaultQrState: { queries: never[]; data: PanelData | undefined; isLoading: boolean } = {
    queries: [],
    data: {
      request: {
        maxDataPoints: 1000,
        interval: '15s',
      },
    } as unknown as PanelData,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSidebar = (
    options: QueryGroupOptions = mockOptions,
    qrState: { queries: never[]; data: PanelData | undefined; isLoading: boolean } = defaultQrState
  ) => {
    const queryOptions: QueryOptionsState = {
      options,
      isQueryOptionsOpen: true,
      setIsQueryOptionsOpen: mockSetIsQueryOptionsOpen,
    };

    return render(
      <QueryEditorProvider
        dsState={{ datasource: undefined, dsSettings: ds1SettingsMock, dsError: undefined }}
        qrState={qrState}
        panelState={{ panel: new VizPanel({ key: 'panel-1' }), transformations: [] }}
        uiState={{
          selectedQuery: null,
          selectedTransformation: null,
          setSelectedQuery: jest.fn(),
          setSelectedTransformation: jest.fn(),
          queryOptions,
          selectedQueryDsData: null,
          selectedQueryDsLoading: false,
          showingDatasourceHelp: false,
          toggleDatasourceHelp: jest.fn(),
          cardType: QueryEditorType.Query,
        }}
        actions={mockActions}
      >
        <QueryEditorDetailsSidebar />
      </QueryEditorProvider>
    );
  };

  it('should render all query options fields', () => {
    renderSidebar();

    expect(screen.getByLabelText('Max data points')).toBeInTheDocument();
    expect(screen.getByLabelText('Min interval')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByLabelText('Relative time')).toBeInTheDocument();
    expect(screen.getByLabelText('Time shift')).toBeInTheDocument();
  });

  it('should close sidebar when header is clicked', async () => {
    renderSidebar();

    const header = screen.getByRole('button', { name: /query options/i });
    fireEvent.click(header);

    expect(mockSetIsQueryOptionsOpen).toHaveBeenCalledWith(false);
  });

  describe('maxDataPoints input', () => {
    it('should call onQueryOptionsChange with updated maxDataPoints on blur', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: '500' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: 500,
        })
      );
    });

    it('should set maxDataPoints to null for invalid input', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: null,
        })
      );
    });

    it('should set maxDataPoints to null for zero', () => {
      renderSidebar();

      const input = screen.getByLabelText('Max data points');
      fireEvent.change(input, { target: { value: '0' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          maxDataPoints: null,
        })
      );
    });
  });

  describe('minInterval input', () => {
    it('should call onQueryOptionsChange with updated minInterval on blur', () => {
      renderSidebar();

      const input = screen.getByLabelText('Min interval');
      fireEvent.change(input, { target: { value: '10s' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minInterval: '10s',
        })
      );
    });

    it('should set minInterval to null for empty input', () => {
      const optionsWithMinInterval = {
        ...mockOptions,
        minInterval: '5s',
      };

      renderSidebar(optionsWithMinInterval);

      const input = screen.getByLabelText('Min interval');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          minInterval: null,
        })
      );
    });
  });

  describe('relativeTime input', () => {
    it('should call onQueryOptionsChange with valid relative time', () => {
      renderSidebar();

      const input = screen.getByLabelText('Relative time');
      fireEvent.change(input, { target: { value: '1h' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            from: '1h',
          }),
        })
      );
    });

    it('should not call onQueryOptionsChange with invalid relative time', () => {
      renderSidebar();

      const input = screen.getByLabelText('Relative time');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      // onQueryOptionsChange should not be called for invalid time
      expect(mockActions.onQueryOptionsChange).not.toHaveBeenCalled();
    });
  });

  describe('timeShift input', () => {
    it('should call onQueryOptionsChange with valid time shift', () => {
      renderSidebar();

      const input = screen.getByLabelText('Time shift');
      fireEvent.change(input, { target: { value: '2h' } });
      fireEvent.blur(input);

      expect(mockActions.onQueryOptionsChange).toHaveBeenCalledWith(
        expect.objectContaining({
          timeRange: expect.objectContaining({
            shift: '2h',
          }),
        })
      );
    });

    it('should not call onQueryOptionsChange with invalid time shift', () => {
      renderSidebar();

      const input = screen.getByLabelText('Time shift');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      // onQueryOptionsChange should not be called for invalid time
      expect(mockActions.onQueryOptionsChange).not.toHaveBeenCalled();
    });
  });

  describe('computed interval display', () => {
    it('should display computed interval from data request', () => {
      renderSidebar();

      // The interval should be displayed as read-only text
      expect(screen.getByText('15s')).toBeInTheDocument();
    });

    it('should display dash when interval is not available', () => {
      const qrStateWithoutInterval = {
        queries: [],
        data: undefined,
        isLoading: false,
      };

      renderSidebar(mockOptions, qrStateWithoutInterval);

      // Should show "-" when no interval
      expect(screen.getByText('-')).toBeInTheDocument();
    });
  });
});
