import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { LogRowModel } from '@grafana/data';

import { LogContextProvider } from '../LogContextProvider';
import { ContextFilter, LokiQuery } from '../types';

import { LokiContextUi, LokiContextUiProps } from './LokiContextUi';

// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

jest.mock('app/core/store', () => {
  return {
    set() {},
    getBool() {
      return true;
    },
  };
});

const setupProps = (): LokiContextUiProps => {
  const defaults: LokiContextUiProps = {
    logContextProvider: mockLogContextProvider as unknown as LogContextProvider,
    updateFilter: jest.fn(),
    row: {
      entry: 'WARN test 1.23 on [xxx]',
      labels: {
        label1: 'value1',
        label3: 'value3',
      },
    } as unknown as LogRowModel,
    onClose: jest.fn(),
    origQuery: {
      expr: '{label1="value1"} | logfmt',
      refId: 'A',
    },
  };

  return defaults;
};

const mockLogContextProvider = {
  getInitContextFiltersFromLabels: jest.fn().mockImplementation(() =>
    Promise.resolve([
      { value: 'value1', enabled: true, fromParser: false, label: 'label1' },
      { value: 'value3', enabled: false, fromParser: true, label: 'label3' },
    ])
  ),
  processContextFiltersToExpr: jest.fn().mockImplementation(
    (row: LogRowModel, contextFilters: ContextFilter[], query: LokiQuery | undefined) =>
      `{${contextFilters
        .filter((filter) => filter.enabled)
        .map((filter) => `${filter.label}="${filter.value}"`)
        .join('` ')}}`
  ),
  getLogRowContext: jest.fn(),
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
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
    });
  });

  it('finds label1 as a real label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[0], 'label1="value1"');
  });

  it('finds label3 as a parsed label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[1], 'label3="value3"');
  });

  it('calls updateFilter when selecting a label', async () => {
    jest.useFakeTimers();
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });
    await selectOptionInTest(screen.getAllByRole('combobox')[1], 'label3="value3"');
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
});
