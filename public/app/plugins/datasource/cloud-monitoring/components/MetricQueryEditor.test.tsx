import { render } from '@testing-library/react';
import React from 'react';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { EditorMode } from '../types';

import { MetricQueryEditor } from './MetricQueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...(jest.requireActual('@grafana/runtime') as unknown as object),
  getTemplateSrv: () => ({
    replace: (val: string) => val,
  }),
}));

const defaultProps = {
  refId: 'A',
  customMetaData: {},
  variableOptionGroup: { options: [] },
  onChange: jest.fn(),
  onRunQuery: jest.fn(),
  query: createMockQuery(),
  datasource: createMockDatasource(),
  editorMode: EditorMode.Visual,
};

describe('MetricQueryEditor', () => {
  it('renders a default time series list query', async () => {
    const onChange = jest.fn();
    const query = createMockQuery();
    // Force to populate with default values
    delete query.timeSeriesList;

    render(<MetricQueryEditor {...defaultProps} onChange={onChange} query={query} />);
    expect(onChange).toHaveBeenCalled();
  });

  it('renders a default time series query', async () => {
    const onChange = jest.fn();
    const query = createMockQuery();
    // Force to populate with default values
    delete query.timeSeriesQuery;

    render(<MetricQueryEditor {...defaultProps} onChange={onChange} query={query} editorMode={EditorMode.MQL} />);
    expect(onChange).toHaveBeenCalled();
  });
});
