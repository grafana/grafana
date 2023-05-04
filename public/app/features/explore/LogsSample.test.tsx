import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import { FieldType, LoadingState, MutableDataFrame, SupplementaryQueryType, DataSourceApi } from '@grafana/data';
import { DataQuery } from '@grafana/schema';

import { LogsSamplePanel } from './LogsSamplePanel';

jest.mock('@grafana/runtime', () => {
  return {
    ...jest.requireActual('@grafana/runtime'),
    reportInteraction: jest.fn(),
  };
});

const createProps = (propOverrides?: Partial<ComponentProps<typeof LogsSamplePanel>>) => {
  const props = {
    queryResponse: undefined,
    enabled: true,
    timeZone: 'timeZone',
    datasourceInstance: undefined,
    setLogsSampleEnabled: jest.fn(),
    queries: [],
    splitOpen: jest.fn(),
  };

  return { ...props, ...propOverrides };
};

const sampleDataFrame = new MutableDataFrame({
  meta: {
    custom: { frameType: 'LabeledTimeValues' },
  },
  fields: [
    {
      name: 'labels',
      type: FieldType.other,
      values: [
        { place: 'luna', source: 'data' },
        { place: 'luna', source: 'data' },
      ],
    },
    {
      name: 'Time',
      type: FieldType.time,
      values: ['2022-02-22T09:28:11.352440161Z', '2022-02-22T14:42:50.991981292Z'],
    },
    {
      name: 'Line',
      type: FieldType.string,
      values: ['line1 ', 'line2'],
    },
  ],
});

describe('LogsSamplePanel', () => {
  it('shows empty panel if no data', () => {
    render(<LogsSamplePanel {...createProps()} />);
    expect(screen.getByText('Logs sample')).toBeInTheDocument();
  });

  it('shows loading message', () => {
    render(<LogsSamplePanel {...createProps({ queryResponse: { data: [], state: LoadingState.Loading } })} />);
    expect(screen.getByText('Logs sample is loading...')).toBeInTheDocument();
  });

  it('shows no data message', () => {
    render(<LogsSamplePanel {...createProps({ queryResponse: { data: [], state: LoadingState.Done } })} />);
    expect(screen.getByText('No logs sample data.')).toBeInTheDocument();
  });

  it('shows logs sample data', () => {
    render(
      <LogsSamplePanel {...createProps({ queryResponse: { data: [sampleDataFrame], state: LoadingState.Done } })} />
    );
    expect(screen.getByText('2022-02-22 04:28:11.352')).toBeInTheDocument();
    expect(screen.getByText('line1')).toBeInTheDocument();
    expect(screen.getByText('2022-02-22 09:42:50.991')).toBeInTheDocument();
    expect(screen.getByText('line2')).toBeInTheDocument();
  });

  it('shows log details', async () => {
    render(
      <LogsSamplePanel {...createProps({ queryResponse: { data: [sampleDataFrame], state: LoadingState.Done } })} />
    );
    const line = screen.getByText('line1');
    expect(screen.queryByText('foo')).not.toBeInTheDocument();
    await userEvent.click(line);
    expect(await screen.findByText('Fields')).toBeInTheDocument();
    expect(await screen.findByText('place')).toBeInTheDocument();
    expect(await screen.findByText('luna')).toBeInTheDocument();
  });

  it('shows warning message', () => {
    render(
      <LogsSamplePanel
        {...createProps({
          queryResponse: { data: [], state: LoadingState.Error, error: { data: { message: 'Test error message' } } },
        })}
      />
    );
    expect(screen.getByText('Failed to load logs sample for this query')).toBeInTheDocument();
    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });
  it('has split open button functionality', async () => {
    const datasourceInstance = {
      uid: 'test_uid',
      getDataProvider: jest.fn(),
      getSupportedSupplementaryQueryTypes: jest.fn().mockImplementation(() => [SupplementaryQueryType.LogsSample]),
      getSupplementaryQuery: jest.fn().mockImplementation(() => {
        return {
          refId: 'test_refid',
        } as DataQuery;
      }),
    } as unknown as DataSourceApi;
    const splitOpen = jest.fn();
    render(
      <LogsSamplePanel
        {...createProps({
          queries: [{ refId: 'test_refid' }],
          queryResponse: { data: [sampleDataFrame], state: LoadingState.Done },
          splitOpen,
          datasourceInstance,
        })}
      />
    );
    const splitButton = screen.getByText('Open logs in split view');
    expect(splitButton).toBeInTheDocument();

    await userEvent.click(splitButton);
    expect(splitOpen).toHaveBeenCalledWith({ datasourceUid: 'test_uid', queries: [{ refId: 'test_refid' }] });
  });
});
