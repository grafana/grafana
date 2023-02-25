import { act, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import { LogRowModel } from '@grafana/data';

import LokiLanguageProvider from '../LanguageProvider';

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
    const mockLanguageProvider = {
      start: jest.fn().mockImplementation(() => Promise.resolve()),
      getLabelValues: (name: string) => {
        switch (name) {
          case 'label1':
            return ['value1-1', 'value1-2'];
          case 'label2':
            return ['value2-1', 'value2-2'];
          case 'label3':
            return ['value3-1', 'value3-2'];
        }
        return [];
      },
      fetchSeriesLabels: (selector: string) => {
        switch (selector) {
          case '{label1="value1-1"}':
            return { label1: ['value1-1'], label2: ['value2-1'], label3: ['value3-1'] };
          case '{label1=~"value1-1|value1-2"}':
            return { label1: ['value1-1', 'value1-2'], label2: ['value2-1'], label3: ['value3-1', 'value3-2'] };
        }
        // Allow full set by default
        return {
          label1: ['value1-1', 'value1-2'],
          label2: ['value2-1', 'value2-2'],
        };
      },
      getLabelKeys: () => ['label1', 'label2'],
    };

    const defaults: LokiContextUiProps = {
      languageProvider: mockLanguageProvider as unknown as LokiLanguageProvider,
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

  it('starts the languageProvider', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);

    await waitFor(() => {
      expect(props.languageProvider.start).toHaveBeenCalled();
    });
  });

  it('finds label1 as a real label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.languageProvider.start).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[0], 'label1');
  });

  it('finds label3 as a parsed label', async () => {
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.languageProvider.start).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[1], 'label3');
  });

  it('calls updateFilter when selecting a label', async () => {
    jest.useFakeTimers();
    const props = setupProps();
    render(<LokiContextUi {...props} />);
    await waitFor(() => {
      expect(props.languageProvider.start).toHaveBeenCalled();
    });
    const select = await screen.findAllByRole('combobox');
    await selectOptionInTest(select[1], 'label3');
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
