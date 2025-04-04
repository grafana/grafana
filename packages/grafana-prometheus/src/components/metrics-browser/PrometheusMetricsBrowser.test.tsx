// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, getDefaultTimeRange, TimeRange } from '@grafana/data';

import PromQlLanguageProvider from '../../language_provider';

import { UnthemedPrometheusMetricsBrowser } from './PrometheusMetricsBrowser';
import { BrowserProps } from './types';

describe('PrometheusMetricsBrowser', () => {
  const setupProps = (): BrowserProps => {
    const mockLanguageProvider = {
      start: () => Promise.resolve(),
      getLabelValues: (timeRange: TimeRange, name: string) => {
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
      // This must always call the series endpoint
      // until we refactor all of the metrics browser
      // to never use the series endpoint.
      // The metrics browser expects both label names and label values.
      // The labels endpoint with match does not supply label values
      // and so using it breaks the metrics browser.
      fetchSeriesLabels: (timeRange: TimeRange, selector: string) => {
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
      getLabelKeys: () => ['label1', 'label2', 'label3'],
    };

    const defaults: BrowserProps = {
      theme: createTheme({ colors: { mode: 'dark' } }),
      onChange: () => {},
      autoSelect: 0,
      languageProvider: mockLanguageProvider as unknown as PromQlLanguageProvider,
      timeRange: getDefaultTimeRange(),
    };

    return defaults;
  };

  // Clear label selection manually because it's saved in localStorage
  afterEach(async () => {
    const clearBtn = screen.getByLabelText('Selector clear button');
    await userEvent.click(clearBtn);
  });

  it('renders and loader shows when empty, and then first set of labels', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);
    // Loading appears and dissappears
    screen.getByText(/Loading labels/);
    await waitFor(() => {
      expect(screen.queryByText(/Loading labels/)).not.toBeInTheDocument();
    });
    // Initial set of labels is available and not selected
    expect(screen.queryByRole('option', { name: 'label1' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'label1', selected: true })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'label2' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'label2', selected: true })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
  });

  it('allows label and value selection/deselection', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);
    // Selecting label2
    const label2 = await screen.findByRole('option', { name: 'label2', selected: false });
    expect(screen.queryByRole('list', { name: /Values/ })).not.toBeInTheDocument();
    await userEvent.click(label2);
    expect(screen.queryByRole('option', { name: 'label2', selected: true })).toBeInTheDocument();
    // List of values for label2 appears
    expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
    expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
    // Selecting label1, list for its values appears
    const label1 = await screen.findByRole('option', { name: 'label1', selected: false });
    await userEvent.click(label1);
    expect(screen.queryByRole('option', { name: 'label1', selected: true })).toBeInTheDocument();
    await screen.findByLabelText('Values for label1');
    expect(await screen.findAllByRole('list', { name: /Values/ })).toHaveLength(2);
    // Selecting value2-2 of label2
    const value = await screen.findByRole('option', { name: 'value2-2', selected: false });
    await userEvent.click(value);
    await screen.findByRole('option', { name: 'value2-2', selected: true });
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-2"}');
    // Selecting value2-1 of label2, both values now selected
    const value2 = await screen.findByRole('option', { name: 'value2-1', selected: false });
    await userEvent.click(value2);
    // await screen.findByRole('option', {name: 'value2-1', selected: true});
    await screen.findByText('{label2=~"value2-1|value2-2"}');
    // Deselecting value2-2, one value should remain
    const selectedValue = await screen.findByRole('option', { name: 'value2-2', selected: true });
    await userEvent.click(selectedValue);
    await screen.findByRole('option', { name: 'value2-1', selected: true });
    await screen.findByRole('option', { name: 'value2-2', selected: false });
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
  });

  it('allows label selection from multiple labels', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);

    // Selecting label2
    const label2 = await screen.findByRole('option', { name: 'label2', selected: false });
    await userEvent.click(label2);
    // List of values for label2 appears
    expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
    expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
    // Selecting label1, list for its values appears
    const label1 = await screen.findByRole('option', { name: 'label1', selected: false });
    await userEvent.click(label1);
    await screen.findByLabelText('Values for label1');
    expect(await screen.findAllByRole('list', { name: /Values/ })).toHaveLength(2);
    // Selecting value2-1 of label2
    const value2 = await screen.findByRole('option', { name: 'value2-1', selected: false });
    await userEvent.click(value2);
    await screen.findByText('{label2="value2-1"}');

    // Selecting value from label1 for combined selector
    const value1 = await screen.findByRole('option', { name: 'value1-2', selected: false });
    await userEvent.click(value1);
    await screen.findByRole('option', { name: 'value1-2', selected: true });
    await screen.findByText('{label1="value1-2",label2="value2-1"}');
    // Deselect label1 should remove label and value
    const selectedLabel = (await screen.findAllByRole('option', { name: /label1/, selected: true }))[0];
    await userEvent.click(selectedLabel);
    await screen.findByRole('option', { name: /label1/, selected: false });
    expect(await screen.findAllByRole('list', { name: /Values/ })).toHaveLength(1);
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label2="value2-1"}');
  });

  it('allows clearing the label selection', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);

    // Selecting label2
    const label2 = await screen.findByRole('option', { name: 'label2', selected: false });
    await userEvent.click(label2);
    // List of values for label2 appears
    expect(screen.queryByLabelText(/Values for/)).toHaveTextContent('label2');
    expect(screen.queryByRole('option', { name: 'value2-1' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'value2-2' })).toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
    // Selecting label1, list for its values appears
    const label1 = await screen.findByRole('option', { name: 'label1', selected: false });
    await userEvent.click(label1);
    await screen.findByLabelText('Values for label1');
    expect(await screen.findAllByRole('list', { name: /Values/ })).toHaveLength(2);
    // Selecting value2-1 of label2
    const value2 = await screen.findByRole('option', { name: 'value2-1', selected: false });
    await userEvent.click(value2);
    await screen.findByText('{label2="value2-1"}');

    // Clear selector
    const clearBtn = screen.getByLabelText('Selector clear button');
    await userEvent.click(clearBtn);
    await screen.findByRole('option', { name: 'label2', selected: false });
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{}');
  });

  it('filters values by input text', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);
    // Selecting label2 and label1
    const label2 = await screen.findByRole('option', { name: /label2/, selected: false });
    await userEvent.click(label2);
    const label1 = await screen.findByRole('option', { name: /label1/, selected: false });
    await userEvent.click(label1);
    await screen.findByLabelText('Values for label1');
    await screen.findByLabelText('Values for label2');
    expect(await screen.findAllByRole('option', { name: /value/ })).toHaveLength(4);
    // Typing '1' to filter for values
    await userEvent.type(screen.getByLabelText('Filter expression for label values'), '1');
    expect(screen.getByLabelText('Filter expression for label values')).toHaveValue('1');
    expect(await screen.findAllByRole('option', { name: /value/ })).toHaveLength(3);
    expect(screen.queryByRole('option', { name: 'value2-2' })).not.toBeInTheDocument();
  });

  it('facets labels', async () => {
    const props = setupProps();
    render(<UnthemedPrometheusMetricsBrowser {...props} />);
    // Selecting label2 and label1
    const label2 = await screen.findByRole('option', { name: /label2/, selected: false });
    await userEvent.click(label2);
    const label1 = await screen.findByRole('option', { name: /label1/, selected: false });
    await userEvent.click(label1);
    await screen.findByLabelText('Values for label1');
    await screen.findByLabelText('Values for label2');
    expect(await screen.findAllByRole('option', { name: /value/ })).toHaveLength(4);
    expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3');
    // Click value1-1 which triggers facetting for value3-x, and still show all value1-x
    const value1 = await screen.findByRole('option', { name: 'value1-1', selected: false });
    await userEvent.click(value1);
    await waitFor(() => expect(screen.queryByRole('option', { name: 'value2-2' })).not.toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'value1-2' })).toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1="value1-1"}');
    expect(screen.queryByRole('option', { name: /label3/ })).toHaveTextContent('label3 (1)');
    // Click value1-2 for which facetting will allow more values for value3-x
    const value12 = await screen.findByRole('option', { name: 'value1-2', selected: false });
    await userEvent.click(value12);
    await screen.findByRole('option', { name: 'value1-2', selected: true });
    await screen.findByRole('option', { name: /label3/, selected: false });
    await userEvent.click(screen.getByRole('option', { name: /label3/ }));
    await screen.findByLabelText('Values for label3');
    expect(screen.queryByRole('option', { name: 'value1-1', selected: true })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'value1-2', selected: true })).toBeInTheDocument();
    expect(screen.queryByLabelText('selector')).toHaveTextContent('{label1=~"value1-1|value1-2"}');
    expect(screen.queryAllByRole('option', { name: /label3/ })[0]).toHaveTextContent('label3 (2)');
  });
});
