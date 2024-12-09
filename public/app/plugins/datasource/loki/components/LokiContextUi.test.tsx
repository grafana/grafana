import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { select } from 'react-select-event';

import { LogRowModel, dateTime } from '@grafana/data';

import { LogContextProvider, SHOULD_INCLUDE_PIPELINE_OPERATIONS } from '../LogContextProvider';
import { ContextFilter, LokiQuery } from '../types';

import { IS_LOKI_LOG_CONTEXT_UI_OPEN, LokiContextUi, LokiContextUiProps } from './LokiContextUi';

// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

const setupProps = (): LokiContextUiProps => {
  const defaults: LokiContextUiProps = {
    logContextProvider: Object.assign({}, mockLogContextProvider) as unknown as LogContextProvider,
    updateFilter: jest.fn(),
    row: {
      entry: 'WARN test 1.23 on [xxx]',
      labels: {
        label1: 'value1',
        label3: 'value3',
      },
      timeEpochMs: new Date().getTime(),
    } as unknown as LogRowModel,
    onClose: jest.fn(),
    origQuery: {
      expr: '{label1="value1"} | logfmt',
      refId: 'A',
    },
    runContextQuery: jest.fn(),
  };

  return defaults;
};

const mockLogContextProvider = {
  getInitContextFilters: jest.fn().mockImplementation(() =>
    Promise.resolve({
      contextFilters: [
        { value: 'value1', enabled: true, nonIndexed: false, label: 'label1' },
        { value: 'value3', enabled: false, nonIndexed: true, label: 'label3' },
      ],
      preservedFiltersApplied: false,
    })
  ),
  processContextFiltersToExpr: jest.fn().mockImplementation(
    (contextFilters: ContextFilter[], query: LokiQuery | undefined) =>
      `{${contextFilters
        .filter((filter) => filter.enabled)
        .map((filter) => `${filter.label}="${filter.value}"`)
        .join('` ')}}`
  ),
  processPipelineStagesToExpr: jest
    .fn()
    .mockImplementation((currentExpr: string, query: LokiQuery | undefined) => `${currentExpr} | newOperation`),
  getLogRowContext: jest.fn(),
  queryContainsValidPipelineStages: jest.fn().mockReturnValue(true),
  prepareExpression: jest.fn().mockImplementation(
    (contextFilters: ContextFilter[], query: LokiQuery | undefined) =>
      `{${contextFilters
        .filter((filter) => filter.enabled)
        .map((filter) => `${filter.label}="${filter.value}"`)
        .join('` ')}}`
  ),
};

describe('LokiContextUi', () => {
  const savedGlobal = global;
  beforeAll(() => {
    // TODO: `structuredClone` is not yet in jsdom https://github.com/jsdom/jsdom/issues/3363
    if (!global.structuredClone) {
      global.structuredClone = function structuredClone(objectToClone: unknown) {
        const stringified = JSON.stringify(objectToClone);
        const parsed = JSON.parse(stringified);
        return parsed;
      };
    }
  });
  afterAll(() => {
    global = savedGlobal;
  });

  beforeEach(() => {
    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
    window.localStorage.setItem(IS_LOKI_LOG_CONTEXT_UI_OPEN, 'true');
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('renders and shows executed query text', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      // We should see the query text (it is split into multiple spans)
      expect(screen.getByText('{')).toBeInTheDocument();
      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('=')).toBeInTheDocument();
      expect(screen.getByText('"value1"')).toBeInTheDocument();
      expect(screen.getByText('}')).toBeInTheDocument();
    });
  });

  it('initialize context filters', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);

    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
    });
  });

  it('calls `getInitContextFilters` with the right set of parameters', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);

    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalledWith(props.row, props.origQuery, {
        from: dateTime(props.row.timeEpochMs),
        to: dateTime(props.row.timeEpochMs),
        raw: { from: dateTime(props.row.timeEpochMs), to: dateTime(props.row.timeEpochMs) },
      });
    });
  });

  it('finds label1 as a real label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
    });
    const selects = await screen.findAllByRole('combobox');
    await select(selects[0], 'label1="value1"', { container: document.body });
  });

  it('finds label3 as a parsed label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
    });
    const selects = await screen.findAllByRole('combobox');
    await select(selects[1], 'label3="value3"', { container: document.body });
  });

  it('calls updateFilter when selecting a label', async () => {
    jest.useFakeTimers();
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFilters).toHaveBeenCalled();
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });
    await select(screen.getAllByRole('combobox')[1], 'label3="value3"', { container: document.body });
    act(() => {
      jest.runAllTimers();
    });
    expect(props.updateFilter).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('unmounts and calls onClose', async () => {
    const props = setupProps();
    const comp = render(<LokiContextUi {...props} />);
    comp.unmount();

    await waitFor(() => {
      expect(props.onClose).toHaveBeenCalled();
    });
  });

  it('displays executed query even if context ui closed', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    // We start with the context ui open and click on it to close
    await userEvent.click(screen.getAllByRole('button')[0]);
    await waitFor(() => {
      // We should see the query text (it is split into multiple spans)
      expect(screen.getByText('{')).toBeInTheDocument();
      expect(screen.getByText('label1')).toBeInTheDocument();
      expect(screen.getByText('=')).toBeInTheDocument();
      expect(screen.getByText('"value1"')).toBeInTheDocument();
      expect(screen.getByText('}')).toBeInTheDocument();
    });
  });

  it('does not show parsed labels section if origQuery has 0 parsers', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"}',
        refId: 'A',
      },
    };
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect(screen.queryByText('Refine the search')).not.toBeInTheDocument();
    });
  });

  it('shows parsed labels section if origQuery has 1 parser', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect(screen.getByText('Refine the search')).toBeInTheDocument();
    });
  });

  it('renders pipeline operations switch as enabled when saved in localstorage', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(true);
    });
  });

  it('renders pipeline operations switch as disabled when saved in localstorage', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'false');
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect((screen.getByRole('switch') as HTMLInputElement).checked).toBe(false);
    });
  });

  it('renders pipeline operations switch if query contains valid pipeline stages', async () => {
    const props = setupProps();
    (props.logContextProvider.queryContainsValidPipelineStages as jest.Mock).mockReturnValue(true);
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  it('does not render pipeline operations switch if query does not contain valid pipeline stages', async () => {
    const props = setupProps();
    (props.logContextProvider.queryContainsValidPipelineStages as jest.Mock).mockReturnValue(false);
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    window.localStorage.setItem(SHOULD_INCLUDE_PIPELINE_OPERATIONS, 'true');
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect(screen.queryByRole('switch')).toBeNull();
    });
  });

  it('does not show parsed labels section if origQuery has 2 parsers', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt | json',
        refId: 'A',
      },
    };
    render(<LokiContextUi {...newProps} />);
    await waitFor(() => {
      expect(screen.queryByText('Refine the search')).not.toBeInTheDocument();
    });
  });

  it('should revert to original query when revert button clicked', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      origQuery: {
        expr: '{label1="value1"} | logfmt',
        refId: 'A',
      },
    };
    render(<LokiContextUi {...newProps} />);
    // In initial query, label3 is not selected
    await waitFor(() => {
      expect(screen.queryByText('label3="value3"')).not.toBeInTheDocument();
    });

    // We select parsed label and label3="value3" should appear
    const parsedLabelsInput = screen.getAllByRole('combobox')[1];
    await userEvent.click(parsedLabelsInput);
    await userEvent.type(parsedLabelsInput, '{enter}');
    expect(screen.getByText('label3="value3"')).toBeInTheDocument();

    // We click on revert button and label3="value3" should disappear
    const revertButton = screen.getByTestId('revert-button');
    await userEvent.click(revertButton);
    await waitFor(() => {
      expect(screen.queryByText('label3="value3"')).not.toBeInTheDocument();
    });
  });
  it('shows if preserved filters are applied', async () => {
    const props = setupProps();
    const newProps = {
      ...props,
      logContextProvider: {
        ...props.logContextProvider,
        getInitContextFilters: jest.fn().mockImplementation(() =>
          Promise.resolve({
            contextFilters: [
              { value: 'value1', enabled: true, nonIndexed: false, label: 'label1' },
              { value: 'value3', enabled: false, nonIndexed: true, label: 'label3' },
            ],
            preservedFiltersApplied: true,
          })
        ),
      },
    } as unknown as LokiContextUiProps;

    render(<LokiContextUi {...newProps} />);
    expect(await screen.findByText('Previously used filters have been applied.')).toBeInTheDocument();
  });

  it('does not shows if preserved filters are not applied', async () => {
    // setupProps() already has preservedFiltersApplied: false
    const props = setupProps();

    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(screen.queryByText('Previously used filters have been applied.')).not.toBeInTheDocument();
    });
  });
});
