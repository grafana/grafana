import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { QueryEditor, Props } from './QueryEditor';
import { scenarios } from './__mocks__/scenarios';
import { defaultQuery } from './constants';
import { TestDataQueryType } from './dataquery.gen';
import { TestDataDataSource } from './datasource';
import { defaultStreamQuery } from './runStreams';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOnChange = jest.fn();
const props = {
  onRunQuery: jest.fn(),
  query: defaultQuery,
  onChange: mockOnChange,
  datasource: {
    getScenarios: () => Promise.resolve(scenarios),
  } as TestDataDataSource,
};

const setup = (testProps?: Partial<Props>) => {
  const editorProps = { ...props, ...testProps };
  return render(<QueryEditor {...editorProps} />);
};

describe('Test Datasource Query Editor', () => {
  it('should render with default scenario', async () => {
    setup();

    expect(await screen.findByText(/random walk/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Alias' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Labels' })).toBeInTheDocument();
  });

  it('should switch scenario and display its default values', async () => {
    const { rerender } = setup();

    let select = (await screen.findByText('Scenario')).nextSibling!.firstChild!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    const scs = screen.getAllByLabelText('Select option');

    expect(scs).toHaveLength(scenarios.length);

    await userEvent.click(screen.getByText('CSV Metric Values'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: TestDataQueryType.CSVMetricValues })
    );
    await rerender(
      <QueryEditor
        {...props}
        query={{ ...defaultQuery, scenarioId: TestDataQueryType.CSVMetricValues, stringInput: '1,20,90,30,5,0' }}
      />
    );
    expect(await screen.findByRole('textbox', { name: /string input/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /string input/i })).toHaveValue('1,20,90,30,5,0');

    await fireEvent.keyDown(select, { keyCode: 40 });
    await userEvent.click(screen.getByText('Grafana API'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: 'grafana_api', stringInput: 'datasources' })
    );
    rerender(
      <QueryEditor
        {...props}
        query={{ ...defaultQuery, scenarioId: TestDataQueryType.GrafanaAPI, stringInput: 'datasources' }}
      />
    );
    expect(await screen.findByText('Grafana API')).toBeInTheDocument();
    expect(screen.getByText('Data Sources')).toBeInTheDocument();

    await fireEvent.keyDown(select, { keyCode: 40 });
    await userEvent.click(screen.getByText('Streaming Client'));
    expect(mockOnChange).toHaveBeenCalledWith(
      expect.objectContaining({ scenarioId: 'streaming_client', stream: defaultStreamQuery })
    );

    const streamQuery = { ...defaultQuery, stream: defaultStreamQuery, scenarioId: TestDataQueryType.StreamingClient };

    rerender(<QueryEditor {...props} query={streamQuery} />);

    expect(await screen.findByText('Streaming Client')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByLabelText('Noise')).toHaveValue(2.2);
    expect(screen.getByLabelText('Speed (ms)')).toHaveValue(250);
    expect(screen.getByLabelText('Spread')).toHaveValue(3.5);
    expect(screen.getByLabelText('Bands')).toHaveValue(1);
  });

  it('persists the datasource from the query when switching scenario', async () => {
    const mockDatasource = {
      type: 'test',
      uid: 'foo',
    };
    setup({
      query: {
        ...defaultQuery,
        datasource: mockDatasource,
      },
    });
    let select = (await screen.findByText('Scenario')).nextSibling!.firstChild!;
    await fireEvent.keyDown(select, { keyCode: 40 });
    await userEvent.click(screen.getByText('Grafana API'));
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ datasource: mockDatasource }));
  });
});
