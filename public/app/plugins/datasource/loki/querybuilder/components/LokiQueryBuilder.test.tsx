import { render, screen, getAllByRole, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { dateTime } from '@grafana/data';
import { config } from '@grafana/runtime';

import { createLokiDatasource } from '../../__mocks__/datasource';
import { LokiOperationId, LokiVisualQuery } from '../types';

import { LokiQueryBuilder, TIME_SPAN_TO_TRIGGER_SAMPLES } from './LokiQueryBuilder';
import { EXPLAIN_LABEL_FILTER_CONTENT } from './LokiQueryBuilderExplained';

const MISSING_LABEL_FILTER_ERROR_MESSAGE = 'Select at least 1 label filter (label and value)';
const defaultQuery: LokiVisualQuery = {
  labels: [{ op: '=', label: 'baz', value: 'bar' }],
  operations: [],
};

const mockTimeRange = {
  from: dateTime(1546372800000),
  to: dateTime(1546380000000),
  raw: {
    from: dateTime(1546372800000),
    to: dateTime(1546380000000),
  },
};

const createDefaultProps = () => {
  const datasource = createLokiDatasource();

  const props = {
    datasource,
    onRunQuery: () => {},
    onChange: () => {},
    showExplain: false,
    timeRange: mockTimeRange,
  };

  return props;
};

describe('LokiQueryBuilder', () => {
  const originalLokiQueryHints = config.featureToggles.lokiQueryHints;
  beforeEach(() => {
    config.featureToggles.lokiQueryHints = true;
  });

  afterEach(() => {
    config.featureToggles.lokiQueryHints = originalLokiQueryHints;
  });
  it('tries to load labels when no labels are selected', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });

    render(<LokiQueryBuilder {...props} query={defaultQuery} />);
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[3]);
    expect(props.datasource.languageProvider.fetchSeriesLabels).toBeCalledWith('{baz="bar"}', {
      timeRange: mockTimeRange,
    });
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
  });

  it('uses fetchLabelValues preselected labels have no equality matcher', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn();
    props.datasource.languageProvider.fetchLabelValues = jest.fn().mockReturnValue(['a', 'b']);

    const query: LokiVisualQuery = {
      labels: [
        { op: '!=', label: 'cluster', value: 'cluster1' },
        { op: '=', label: 'job', value: 'grafana' },
      ],
      operations: [],
    };
    render(<LokiQueryBuilder {...props} query={query} />);
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[5]);
    expect(props.datasource.languageProvider.fetchLabelValues).toBeCalledWith('job', { timeRange: mockTimeRange });
    expect(props.datasource.languageProvider.fetchSeriesLabels).not.toBeCalled();
  });

  it('uses fetchLabelValues preselected label have regex equality matcher with match everything value (.*)', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn();
    props.datasource.languageProvider.fetchLabelValues = jest.fn().mockReturnValue(['a', 'b']);

    const query: LokiVisualQuery = {
      labels: [
        { op: '=~', label: 'cluster', value: '.*' },
        { op: '=', label: 'job', value: 'grafana' },
      ],
      operations: [],
    };
    render(<LokiQueryBuilder {...props} query={query} />);
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[5]);
    expect(props.datasource.languageProvider.fetchLabelValues).toBeCalledWith('job', { timeRange: mockTimeRange });
    expect(props.datasource.languageProvider.fetchSeriesLabels).not.toBeCalled();
  });

  it('uses fetchLabels preselected label have regex equality matcher with match everything value (.*)', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn();
    props.datasource.languageProvider.fetchLabels = jest.fn().mockReturnValue(['a', 'b']);

    const query: LokiVisualQuery = {
      labels: [
        { op: '=~', label: 'cluster', value: '.*' },
        { op: '=', label: 'job', value: 'grafana' },
      ],
      operations: [],
    };
    render(<LokiQueryBuilder {...props} query={query} />);
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[3]);
    expect(props.datasource.languageProvider.fetchLabels).toBeCalledWith({ timeRange: mockTimeRange });
    expect(props.datasource.languageProvider.fetchSeriesLabels).not.toBeCalled();
  });

  it('uses fetchSeriesLabels preselected label have regex equality matcher', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest.fn().mockReturnValue({ job: ['a'], instance: ['b'] });
    props.datasource.languageProvider.fetchLabelValues = jest.fn();

    const query: LokiVisualQuery = {
      labels: [
        { op: '=~', label: 'cluster', value: 'cluster1|cluster2' },
        { op: '=', label: 'job', value: 'grafana' },
      ],
      operations: [],
    };
    render(<LokiQueryBuilder {...props} query={query} />);
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[5]);
    expect(props.datasource.languageProvider.fetchSeriesLabels).toBeCalledWith('{cluster=~"cluster1|cluster2"}', {
      timeRange: mockTimeRange,
    });
    expect(props.datasource.languageProvider.fetchLabelValues).not.toBeCalled();
  });

  it('does refetch label values with the correct time range', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest
      .fn()
      .mockReturnValue({ job: ['a'], instance: ['b'], baz: ['bar'] });

    render(<LokiQueryBuilder {...props} query={defaultQuery} />);
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[3]);
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
    await userEvent.click(screen.getByText('job'));
    await userEvent.click(selects[5]);
    expect(props.datasource.languageProvider.fetchSeriesLabels).toHaveBeenNthCalledWith(2, '{baz="bar"}', {
      timeRange: mockTimeRange,
    });
  });

  it('does not show already existing label names as option in label filter', async () => {
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);
    props.datasource.languageProvider.fetchSeriesLabels = jest
      .fn()
      .mockReturnValue({ job: ['a'], instance: ['b'], baz: ['bar'] });

    render(<LokiQueryBuilder {...props} query={defaultQuery} />);
    await userEvent.click(screen.getByLabelText('Add'));
    const labels = screen.getByText(/Label filters/);
    const selects = getAllByRole(getSelectParent(labels)!, 'combobox');
    await userEvent.click(selects[3]);
    await waitFor(() => expect(screen.getByText('job')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText('instance')).toBeInTheDocument());
    await waitFor(() => expect(screen.getAllByText('baz')).toHaveLength(1));
  });

  it('shows error for query with operations and no stream selector', async () => {
    const query = { labels: [], operations: [{ id: LokiOperationId.Logfmt, params: [] }] };
    render(<LokiQueryBuilder {...createDefaultProps()} query={query} />);

    expect(await screen.findByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).toBeInTheDocument();
  });

  it('shows no error for query with empty __line_contains operation and no stream selector', async () => {
    const query = { labels: [], operations: [{ id: LokiOperationId.LineContains, params: [''] }] };
    render(<LokiQueryBuilder {...createDefaultProps()} query={query} />);

    await waitFor(() => {
      expect(screen.queryByText(MISSING_LABEL_FILTER_ERROR_MESSAGE)).not.toBeInTheDocument();
    });
  });
  it('shows explain section when showExplain is true', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    props.showExplain = true;
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    render(<LokiQueryBuilder {...props} query={query} />);
    expect(await screen.findByText(EXPLAIN_LABEL_FILTER_CONTENT)).toBeInTheDocument();
  });

  it('does not shows explain section when showExplain is false', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    render(<LokiQueryBuilder {...props} query={query} />);
    await waitFor(() => {
      expect(screen.queryByText(EXPLAIN_LABEL_FILTER_CONTENT)).not.toBeInTheDocument();
    });
  });

  it('re-runs sample query when query changes', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    const { rerender } = render(<LokiQueryBuilder {...props} query={query} />);
    rerender(
      <LokiQueryBuilder
        {...props}
        query={{ ...query, labels: [...query.labels, { label: 'xyz', op: '=', value: 'abc' }] }}
      />
    );

    await waitFor(() => {
      expect(props.datasource.getDataSamples).toHaveBeenCalledTimes(2);
    });
  });

  it('does not re-run sample query when query does not change', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    const { rerender } = render(<LokiQueryBuilder {...props} query={query} />);
    rerender(<LokiQueryBuilder {...props} query={query} />);

    await waitFor(() => {
      expect(props.datasource.getDataSamples).toHaveBeenCalledTimes(1);
    });
  });

  it('re-run sample query when time range changes over 5 minutes', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    const updatedFrom = dateTime(props.timeRange.from.valueOf() + TIME_SPAN_TO_TRIGGER_SAMPLES + 1000);
    const updatedTo = dateTime(props.timeRange.to.valueOf() + TIME_SPAN_TO_TRIGGER_SAMPLES + 1000);
    const updatedTimeRange = {
      from: updatedFrom,
      to: updatedTo,
      raw: {
        from: updatedFrom,
        to: updatedTo,
      },
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    const { rerender } = render(<LokiQueryBuilder {...props} query={query} />);
    rerender(<LokiQueryBuilder {...props} query={query} timeRange={updatedTimeRange} />);

    await waitFor(() => {
      expect(props.datasource.getDataSamples).toHaveBeenCalledTimes(2);
    });
  });

  it('does not re-run sample query when time range changes less than 5 minutes', async () => {
    const query = {
      labels: [{ label: 'foo', op: '=', value: 'bar' }],
      operations: [{ id: LokiOperationId.LineContains, params: ['error'] }],
    };
    const props = createDefaultProps();
    const updatedFrom = dateTime(props.timeRange.from.valueOf() + TIME_SPAN_TO_TRIGGER_SAMPLES - 1000);
    const updatedTo = dateTime(props.timeRange.to.valueOf() + TIME_SPAN_TO_TRIGGER_SAMPLES - 1000);
    const updatedTimeRange = {
      from: updatedFrom,
      to: updatedTo,
      raw: {
        from: updatedFrom,
        to: updatedTo,
      },
    };
    props.datasource.getDataSamples = jest.fn().mockResolvedValue([]);

    const { rerender } = render(<LokiQueryBuilder {...props} query={query} />);
    rerender(<LokiQueryBuilder {...props} query={query} timeRange={updatedTimeRange} />);

    await waitFor(() => {
      expect(props.datasource.getDataSamples).toHaveBeenCalledTimes(1);
    });
  });
});

const getSelectParent = (input: HTMLElement) =>
  input.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
