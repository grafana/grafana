import { render, screen } from '@testing-library/react';

import { SelectableValue } from '@grafana/data';

import createMockDatasource from '../../mocks/datasource';
import createMockQuery from '../../mocks/query';
import { AzureMonitorQuery, ResultFormat } from '../../types/query';

import FormatAsField from './FormatAsField';

const options = [
  { label: 'Table', value: ResultFormat.Table },
  { label: 'Trace', value: ResultFormat.Trace },
  { label: 'Time Series', value: ResultFormat.TimeSeries },
];
const setFormatAs = (query: AzureMonitorQuery, formatAs: ResultFormat): AzureMonitorQuery => {
  return {
    ...query,
    azureTraces: {
      ...query.azureTraces,
      resultFormat: formatAs,
    },
  };
};

const onLoad = (
  _query: AzureMonitorQuery,
  _defaultValue: ResultFormat,
  _handleChange: (change: SelectableValue<ResultFormat>) => void
) => {};

const props = {
  query: createMockQuery(),
  datasource: createMockDatasource(),
  variableOptionGroup: { label: 'Templates', options: [] },
  onQueryChange: jest.fn(),
  setError: jest.fn(),
  isLoading: false,
  inputId: 'input-id',
  options,
  defaultValue: ResultFormat.Table,
  setFormatAs,
  resultFormat: undefined,
  onLoad: onLoad,
};

describe('FormatAsField', () => {
  it('should render the current value', async () => {
    const query = {
      ...props.query,
      azureTraces: {
        resultFormat: ResultFormat.Trace,
      },
    };
    render(<FormatAsField {...props} resultFormat={query.azureTraces.resultFormat} query={query} />);
    expect(screen.getByText('Trace')).toBeInTheDocument();
  });

  it('should render the default value if selected is not in list of options', async () => {
    const query = {
      ...props.query,
      azureTraces: {
        resultFormat: ResultFormat.Trace,
      },
    };

    const shortOptions = options.slice(0, 1);

    const { rerender } = render(
      <FormatAsField {...props} resultFormat={query.azureTraces.resultFormat} options={shortOptions} query={query} />
    );

    const newQuery = {
      ...query,
      azureTraces: { ...query.azureTraces, resultFormat: props.defaultValue },
    };
    expect(props.onQueryChange).toHaveBeenCalledWith(newQuery);
    rerender(
      <FormatAsField
        {...props}
        resultFormat={newQuery.azureTraces.resultFormat}
        options={shortOptions}
        query={newQuery}
      />
    );
    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(screen.queryByText('Trace')).not.toBeInTheDocument();
  });
});
