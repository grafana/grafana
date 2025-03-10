// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme } from '@grafana/data';

import PromQlLanguageProvider from '../language_provider';

import {
  BrowserProps,
  buildSelector,
  facetLabels,
  SelectableLabel,
  UnthemedPrometheusMetricsBrowser,
} from './PrometheusMetricsBrowser';

describe('buildSelector()', () => {
  it('returns an empty selector for no labels', () => {
    expect(buildSelector([])).toEqual('{}');
  });
  it('returns an empty selector for selected labels with no values', () => {
    const labels: SelectableLabel[] = [{ name: 'foo', selected: true }];
    expect(buildSelector(labels)).toEqual('{}');
  });
  it('returns an empty selector for one selected label with no selected values', () => {
    const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar' }] }];
    expect(buildSelector(labels)).toEqual('{}');
  });
  it('returns a simple selector from a selected label with a selected value', () => {
    const labels: SelectableLabel[] = [{ name: 'foo', selected: true, values: [{ name: 'bar', selected: true }] }];
    expect(buildSelector(labels)).toEqual('{foo="bar"}');
  });
  it('metric selector without labels', () => {
    const labels: SelectableLabel[] = [{ name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] }];
    expect(buildSelector(labels)).toEqual('foo{}');
  });
  it('selector with multiple metrics', () => {
    const labels: SelectableLabel[] = [
      {
        name: '__name__',
        selected: true,
        values: [
          { name: 'foo', selected: true },
          { name: 'bar', selected: true },
        ],
      },
    ];
    expect(buildSelector(labels)).toEqual('{__name__=~"foo|bar"}');
  });
  it('metric selector with labels', () => {
    const labels: SelectableLabel[] = [
      { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
      { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
    ];
    expect(buildSelector(labels)).toEqual('foo{bar="baz"}');
  });

  describe('utf8 support', () => {
    it('metric selector with utf8 metric', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('{"utf8.metric"}');
    });

    it('metric selector with utf8 labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
        { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('foo{"utf8.label"="baz"}');
    });

    it('metric selector with utf8 labels and metrics', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
        { name: 'utf8.label', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('{"utf8.metric","utf8.label"="baz"}');
    });

    it('metric selector with utf8 metric and with utf8/non-utf8 labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'utf8.metric', selected: true }] },
        { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
        { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('{"utf8.metric","utf8.label"="uuu",bar="baz"}');
    });

    it('metric selector with non-utf8 metric with utf8/non-utf8 labels', () => {
      const labels: SelectableLabel[] = [
        { name: '__name__', selected: true, values: [{ name: 'foo', selected: true }] },
        { name: 'utf8.label', selected: true, values: [{ name: 'uuu', selected: true }] },
        { name: 'bar', selected: true, values: [{ name: 'baz', selected: true }] },
      ];
      expect(buildSelector(labels)).toEqual('foo{"utf8.label"="uuu",bar="baz"}');
    });
  });
});

describe('facetLabels()', () => {
  const possibleLabels = {
    cluster: ['dev'],
    namespace: ['alertmanager'],
  };
  const labels: SelectableLabel[] = [
    { name: 'foo', selected: true, values: [{ name: 'bar' }] },
    { name: 'cluster', values: [{ name: 'dev' }, { name: 'ops' }, { name: 'prod' }] },
    { name: 'namespace', values: [{ name: 'alertmanager' }] },
  ];

  it('returns no labels given an empty label set', () => {
    expect(facetLabels([], {})).toEqual([]);
  });

  it('marks all labels as hidden when no labels are possible', () => {
    const result = facetLabels(labels, {});
    expect(result.length).toEqual(labels.length);
    expect(result[0].hidden).toBeTruthy();
    expect(result[0].values).toBeUndefined();
  });

  it('keeps values as facetted when they are possible', () => {
    const result = facetLabels(labels, possibleLabels);
    expect(result.length).toEqual(labels.length);
    expect(result[0].hidden).toBeTruthy();
    expect(result[0].values).toBeUndefined();
    expect(result[1].hidden).toBeFalsy();
    expect(result[1].values!.length).toBe(1);
    expect(result[1].values![0].name).toBe('dev');
  });

  it('does not facet out label values that are currently being facetted', () => {
    const result = facetLabels(labels, possibleLabels, 'cluster');
    expect(result.length).toEqual(labels.length);
    expect(result[0].hidden).toBeTruthy();
    expect(result[1].hidden).toBeFalsy();
    // 'cluster' is being facetted, should show all 3 options even though only 1 is possible
    expect(result[1].values!.length).toBe(3);
    expect(result[2].values!.length).toBe(1);
  });
});

describe('PrometheusMetricsBrowser', () => {
  const setupProps = (): BrowserProps => {
    const mockLanguageProvider = {
      start: () => Promise.resolve(),
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
      // This must always call the series endpoint
      // until we refactor all of the metrics browser
      // to never use the series endpoint.
      // The metrics browser expects both label names and label values.
      // The labels endpoint with match does not supply label values
      // and so using it breaks the metrics browser.
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
      getLabelKeys: () => ['label1', 'label2', 'label3'],
    };

    const defaults: BrowserProps = {
      theme: createTheme({ colors: { mode: 'dark' } }),
      onChange: () => {},
      autoSelect: 0,
      languageProvider: mockLanguageProvider as unknown as PromQlLanguageProvider,
      lastUsedLabels: [],
      storeLastUsedLabels: () => {},
      deleteLastUsedLabels: () => {},
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
