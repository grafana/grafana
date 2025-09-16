// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PromQueryField.test.tsx
import { getByTestId, render, screen } from '@testing-library/react';
// @ts-ignore
import userEvent from '@testing-library/user-event';

import { CoreApp, DataFrame, dateTime, LoadingState, PanelData } from '@grafana/data';

import { PrometheusDatasource } from '../datasource';
import * as queryHints from '../query_hints';

import { PromQueryField } from './PromQueryField';
import { Props } from './monaco-query-field/MonacoQueryFieldProps';

// the monaco-based editor uses lazy-loading and that does not work
// well with this test, and we do not need the monaco-related
// functionality in this test anyway, so we mock it out.
jest.mock('./monaco-query-field/MonacoQueryFieldLazy', () => {
  const fakeQueryField = (props: Props) => {
    return <input onBlur={(e) => props.onBlur(e.currentTarget.value)} data-testid={'dummy-code-input'} type={'text'} />;
  };
  return {
    MonacoQueryFieldLazy: fakeQueryField,
  };
});

const defaultProps = {
  datasource: {
    languageProvider: {
      start: () => Promise.resolve([]),
      syntax: () => {},
      // getLabelKeys: () => [],
      retrieveMetrics: () => [],
    },
  } as unknown as PrometheusDatasource,
  query: {
    expr: '',
    refId: '',
  },
  onRunQuery: () => {},
  onChange: () => {},
  history: [],
  range: {
    from: dateTime('2022-01-01T00:00:00Z'),
    to: dateTime('2022-01-02T00:00:00Z'),
    raw: {
      from: 'now-1d',
      to: 'now',
    },
  },
};

describe('PromQueryField', () => {
  beforeAll(() => {
    // @ts-ignore
    window.getSelection = () => {};
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders metrics chooser regularly if lookups are not disabled in the datasource settings', async () => {
    const queryField = render(<PromQueryField {...defaultProps} />);

    // wait for component to render
    await screen.findByRole('button');

    expect(queryField.getAllByRole('button')).toHaveLength(1);
  });

  it('renders a disabled metrics chooser if lookups are disabled in datasource settings', async () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;
    const queryField = render(<PromQueryField {...props} />);

    // wait for component to render
    await screen.findByRole('button');

    const bcButton = queryField.getByRole('button');
    expect(bcButton).toBeDisabled();
  });

  it('renders no metrics chooser if hidden by props', async () => {
    const props = {
      ...defaultProps,
      hideMetricsBrowser: true,
    };
    const queryField = render(<PromQueryField {...props} />);

    // wait for component to render
    await screen.findByTestId('dummy-code-input');

    expect(queryField.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders an initial hint if no data and initial hint provided', async () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;

    jest.spyOn(queryHints, 'getInitHints').mockReturnValue([{ label: 'Initial hint', type: 'INFO' }]);

    render(<PromQueryField {...props} />);

    // wait for component to render
    await screen.findByRole('button');

    expect(screen.getByText('Initial hint')).toBeInTheDocument();
  });

  it('renders query hint if data, query hint and initial hint provided', async () => {
    const props = defaultProps;
    props.datasource.lookupsDisabled = true;
    props.datasource.getQueryHints = () => [{ label: 'Query hint', type: 'INFO' }];
    render(
      <PromQueryField
        {...props}
        data={
          {
            series: [{ name: 'test name' }] as DataFrame[],
            state: LoadingState.Done,
          } as PanelData
        }
      />
    );

    // wait for component to render
    await screen.findByRole('button');

    expect(screen.getByText('Query hint')).toBeInTheDocument();
    expect(screen.queryByText('Initial hint')).not.toBeInTheDocument();
  });

  it('should not run query onBlur', async () => {
    const onRunQuery = jest.fn();
    const { container } = render(<PromQueryField {...defaultProps} app={CoreApp.Explore} onRunQuery={onRunQuery} />);

    // wait for component to rerender
    await screen.findByRole('button');

    const input = getByTestId(container, 'dummy-code-input');
    expect(input).toBeInTheDocument();
    await userEvent.type(input, 'metric');

    // blur element
    await userEvent.click(document.body);
    expect(onRunQuery).not.toHaveBeenCalled();
  });
});
