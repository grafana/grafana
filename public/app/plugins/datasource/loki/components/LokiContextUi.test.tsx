import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { LogRowModel } from '@grafana/data';

import { LogContextProvider } from '../LogContextProvider';

import { LokiContextUi, LokiContextUiProps } from './LokiContextUi';

// we have to mock out reportInteraction, otherwise it crashes the test.
jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: () => null,
}));

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
  const setupProps = (): LokiContextUiProps => {
    const mockLogContextProvider = {
      getInitContextFiltersFromLabels: jest.fn().mockImplementation(() =>
        Promise.resolve([
          { value: 'label1', enabled: true, fromParser: false, label: 'label1' },
          { value: 'label3', enabled: false, fromParser: true, label: 'label3' },
        ])
      ),
    };

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
    };

    return defaults;
  };

  it('renders and shows basic text', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);

    // Initial set of labels is available and not selected
    expect(await screen.findByText(/Select labels to be included in the context query/)).toBeInTheDocument();
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
    await selectOptionInTest(select[0], 'label1');
  });

  it('finds label3 as a parsed label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[1], 'label3');
  });

  it('calls updateFilter when selecting a label', async () => {
    jest.useFakeTimers();
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.logContextProvider.getInitContextFiltersFromLabels).toHaveBeenCalled();
      expect(screen.getAllByRole('combobox')).toHaveLength(2);
    });
    await selectOptionInTest(screen.getAllByRole('combobox')[1], 'label3');
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
});
