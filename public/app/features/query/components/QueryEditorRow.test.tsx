import { render, screen, waitFor } from '@testing-library/react';
import { PropsWithChildren } from 'react';

import { DataQueryRequest, dateTime, LoadingState, PanelData, toDataFrame } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { filterPanelDataToQuery, Props, QueryEditorRow, QueryLibraryEditingBadge } from './QueryEditorRow';

const mockDS = mockDataSource({
  name: 'test',
  type: 'testdata',
});

// Mock the QueryLibraryContext
const mockQueryLibraryContext = {
  queryLibraryEnabled: true,
};

jest.mock('app/features/explore/QueryLibrary/QueryLibraryContext', () => ({
  useQueryLibraryContext: () => mockQueryLibraryContext,
}));

// Mock the internationalization function
jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (key: string, defaultValue: string) => defaultValue,
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    get: () => Promise.resolve(mockDS),
    getList: () => {},
    getInstanceSettings: () => mockDS,
  }),
}));

// Draggable fails to render in tests, so we mock it out
jest.mock('app/core/components/QueryOperationRow/QueryOperationRow', () => ({
  QueryOperationRow: (props: PropsWithChildren) => <div>{props.children}</div>,
}));

function makePretendRequest(requestId: string, subRequests?: DataQueryRequest[]): DataQueryRequest {
  return {
    requestId,
    // subRequests,
  } as DataQueryRequest;
}

describe('filterPanelDataToQuery', () => {
  const data: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B222' }], meta: {} }),
      toDataFrame({ refId: 'B', fields: [{ name: 'B333' }], meta: {} }),
      toDataFrame({ refId: 'C', fields: [{ name: 'CCCC' }], meta: { requestId: 'sub3' } }),
    ],
    errors: [
      {
        refId: 'B',
        message: 'Error!!',
      },
    ],
    request: makePretendRequest('111', [
      makePretendRequest('sub1'),
      makePretendRequest('sub2'),
      makePretendRequest('sub3'),
    ]),
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  it('should not have an error unless the refId matches', () => {
    const panelData = filterPanelDataToQuery(data, 'A');
    expect(panelData?.series.length).toBe(1);
    expect(panelData?.series[0].refId).toBe('A');
    expect(panelData?.error).toBeUndefined();
    expect(panelData?.errors).toBeUndefined();
  });

  it('should match the error to the query', () => {
    const panelData = filterPanelDataToQuery(data, 'B');
    expect(panelData?.series.length).toBe(3);
    expect(panelData?.series[0].refId).toBe('B');
    expect(panelData?.error!.refId).toBe('B');
    expect(panelData?.errors![0].refId).toBe('B');
  });

  it('should include errors when missing data', () => {
    const withError = {
      series: [],
      error: {
        message: 'Error!!',
      },
      errors: [{ message: 'Error!!' }],
    } as unknown as PanelData;

    const panelData = filterPanelDataToQuery(withError, 'B');
    expect(panelData).toBeDefined();
    expect(panelData?.state).toBe(LoadingState.Error);
    expect(panelData?.error).toBe(withError.error);
    expect(panelData?.errors).toEqual(withError.errors);
  });

  it('should set the state to done if the frame has no errors', () => {
    const withError = {
      ...data,
    };
    withError.state = LoadingState.Error;

    const panelDataB = filterPanelDataToQuery(withError, 'B');
    expect(panelDataB?.series.length).toBe(3);
    expect(panelDataB?.series[0].refId).toBe('B');
    expect(panelDataB?.state).toBe(LoadingState.Error);

    const panelDataA = filterPanelDataToQuery(withError, 'A');
    expect(panelDataA?.series.length).toBe(1);
    expect(panelDataA?.series[0].refId).toBe('A');
    expect(panelDataA?.state).toBe(LoadingState.Done);
  });

  it('should return error for query that returns no data, but another query does return data', () => {
    const withError = {
      ...data,
      state: LoadingState.Error,
      error: {
        message: 'Sad',
        refId: 'Q',
      },
    };

    const panelDataB = filterPanelDataToQuery(withError, 'Q');
    expect(panelDataB?.series.length).toBe(0);
    expect(panelDataB?.error?.refId).toBe('Q');
    expect(panelDataB?.errors![0].refId).toBe('Q');
  });

  it('should not set the state to done if the frame is loading and has no errors', () => {
    const loadingData: PanelData = {
      state: LoadingState.Loading,
      series: [
        toDataFrame({ refId: 'A', fields: [{ name: 'AAA' }], meta: {} }),
        toDataFrame({ refId: 'B', fields: [{ name: 'B111' }], meta: {} }),
      ],
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };

    const panelDataB = filterPanelDataToQuery(loadingData, 'B');
    expect(panelDataB?.state).toBe(LoadingState.Loading);

    const panelDataA = filterPanelDataToQuery(loadingData, 'A');
    expect(panelDataA?.state).toBe(LoadingState.Loading);
  });
  it('should keep the state in loading until all queries are finished, even if the current query has errored', () => {
    const loadingData: PanelData = {
      state: LoadingState.Loading,
      series: [],
      error: {
        refId: 'A',
        message: 'Error',
      },
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };

    const panelDataA = filterPanelDataToQuery(loadingData, 'A');
    expect(panelDataA?.state).toBe(LoadingState.Loading);
  });
  it('should keep the state in loading until all queries are finished, if another query has errored', () => {
    const loadingData: PanelData = {
      state: LoadingState.Loading,
      series: [],
      error: {
        refId: 'B',
        message: 'Error',
      },
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };

    const panelDataA = filterPanelDataToQuery(loadingData, 'A');
    expect(panelDataA?.state).toBe(LoadingState.Loading);
  });
});

describe('frame results with warnings', () => {
  const metaWarning = {
    notices: [
      {
        severity: 'warning',
        text: 'Reduce operation is not needed. Input query or expression A is already reduced data.',
      },
    ],
  };
  const metaInfo = {
    notices: [
      {
        severity: 'info',
        text: 'For your info, something is up.',
      },
    ],
  };
  const metaWarningAndInfo = {
    notices: [
      {
        severity: 'warning',
        text: 'Reduce operation is not needed. Input query or expression A is already reduced data.',
      },
      {
        severity: 'info',
        text: 'For your info, something is up.',
      },
    ],
  };

  const dataWithWarningsAndInfo: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B1' }],
        meta: metaWarningAndInfo,
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B2' }],
        meta: metaWarningAndInfo,
      }),
    ],
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  const dataWithWarningsOnly: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B1' }],
        meta: metaWarning,
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B2' }],
        meta: metaWarning,
      }),
    ],
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  const dataWithInfosOnly: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B1' }],
        meta: metaInfo,
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B2' }],
        meta: metaInfo,
      }),
    ],
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  const dataWithoutWarningsOrInfo: PanelData = {
    state: LoadingState.Done,
    series: [
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B1' }],
        meta: {},
      }),
      toDataFrame({
        refId: 'B',
        fields: [{ name: 'B2' }],
        meta: {},
      }),
    ],
    timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  };

  it('should show both badges and de-duplicate messages', () => {
    // @ts-ignore: there are _way_ too many props to inject here :(
    const editorRow = new QueryEditorRow({
      data: dataWithWarningsAndInfo,
      query: {
        refId: 'B',
      },
    });

    const warningsComponent = editorRow.renderWarnings('warning');
    expect(warningsComponent).not.toBe(null);

    const infosComponent = editorRow.renderWarnings('info');
    expect(infosComponent).not.toBe(null);

    render(warningsComponent!);
    render(infosComponent!);
    expect(screen.getByText('1 warning')).toBeInTheDocument();
    expect(screen.getByText('1 info')).toBeInTheDocument();
  });

  it('should show a warning badge and de-duplicate warning messages', () => {
    // @ts-ignore: there are _way_ too many props to inject here :(
    const editorRow = new QueryEditorRow({
      data: dataWithWarningsOnly,
      query: {
        refId: 'B',
      },
    });

    const warningsComponent = editorRow.renderWarnings('warning');
    expect(warningsComponent).not.toBe(null);

    const infosComponent = editorRow.renderWarnings('info');
    expect(infosComponent).toBe(null);

    render(warningsComponent!);
    expect(screen.getByText('1 warning')).toBeInTheDocument();
  });

  it('should show an info badge and de-duplicate info messages', () => {
    // @ts-ignore: there are _way_ too many props to inject here :(
    const editorRow = new QueryEditorRow({
      data: dataWithInfosOnly,
      query: {
        refId: 'B',
      },
    });

    const warningsComponent = editorRow.renderWarnings('warning');
    expect(warningsComponent).toBe(null);

    const infosComponent = editorRow.renderWarnings('info');
    expect(infosComponent).not.toBe(null);

    render(infosComponent!);
    expect(screen.getByText('1 info')).toBeInTheDocument();
  });

  it('should not show any badge when there are no warnings or info', () => {
    // @ts-ignore: there are _way_ too many props to inject here :(
    const editorRow = new QueryEditorRow({
      data: dataWithoutWarningsOrInfo,
      query: {
        refId: 'B',
      },
    });

    const warningsComponent = editorRow.renderWarnings('warning');
    expect(warningsComponent).toBe(null);

    const infosComponent = editorRow.renderWarnings('info');
    expect(infosComponent).toBe(null);
  });
});
describe('QueryEditorRow', () => {
  const props = (data: PanelData): Props<DataQuery> => ({
    dataSource: mockDS,
    query: { refId: 'B' },
    data,
    queries: [{ refId: 'B' }],
    id: 'test',
    onAddQuery: jest.fn(),
    onRunQuery: jest.fn(),
    onChange: jest.fn(),
    onRemoveQuery: jest.fn(),
    onReplace: jest.fn(),
    index: 0,
    range: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
  });
  it('should display error message in corresponding panel', async () => {
    const data = {
      state: LoadingState.Error,
      series: [],
      errors: [{ message: 'Error!!', refId: 'B' }],
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    render(<QueryEditorRow {...props(data)} />);
    expect(await screen.findByText('Error!!')).toBeInTheDocument();
  });
  it('should display error message in corresponding panel if only error field is provided', async () => {
    const data = {
      state: LoadingState.Error,
      series: [],
      error: { message: 'Error!!', refId: 'B' },
      errors: [],
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    render(<QueryEditorRow {...props(data)} />);
    expect(await screen.findByText('Error!!')).toBeInTheDocument();
  });
  it('should not display error message if error.refId doesnt match', async () => {
    const data = {
      state: LoadingState.Error,
      series: [],
      errors: [{ message: 'Error!!', refId: 'A' }],
      timeRange: { from: dateTime(), to: dateTime(), raw: { from: 'now-1d', to: 'now' } },
    };
    render(<QueryEditorRow {...props(data)} />);
    await waitFor(() => {
      expect(screen.queryByText('Error!!')).not.toBeInTheDocument();
    });
  });
});

describe('QueryLibraryBadge', () => {
  beforeEach(() => {
    mockQueryLibraryContext.queryLibraryEnabled = true;
  });

  it('should display badge when queryLibraryEnabled is true and queryLibraryRef is provided', () => {
    render(<QueryLibraryEditingBadge queryLibraryRef="library-query-123" />);
    expect(screen.getByText('Editing From Query Library')).toBeInTheDocument();
  });

  it('should not display badge when queryLibraryEnabled is false', () => {
    mockQueryLibraryContext.queryLibraryEnabled = false;
    render(<QueryLibraryEditingBadge queryLibraryRef="library-query-123" />);
    expect(screen.queryByText('Editing From Query Library')).not.toBeInTheDocument();
  });

  it('should not display badge when queryLibraryRef is not provided', () => {
    render(<QueryLibraryEditingBadge />);
    expect(screen.queryByText('Editing From Query Library')).not.toBeInTheDocument();
  });

  it('should not display badge when queryLibraryRef is empty string', () => {
    render(<QueryLibraryEditingBadge queryLibraryRef="" />);
    expect(screen.queryByText('Editing From Query Library')).not.toBeInTheDocument();
  });
});
