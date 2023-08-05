import { render, waitFor } from '@testing-library/react';
import React from 'react';

import { createMockDatasource } from '../__mocks__/cloudMonitoringDatasource';
import { createMockQuery } from '../__mocks__/cloudMonitoringQuery';
import { QueryType } from '../types/query';

import { QueryEditor } from './QueryEditor';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
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
};

describe('QueryEditor', () => {
  it('should migrate the given query', async () => {
    const datasource = createMockDatasource();
    const onChange = jest.fn();
    datasource.migrateQuery = jest.fn().mockReturnValue(defaultProps.query);

    render(<QueryEditor {...defaultProps} datasource={datasource} onChange={onChange} />);
    await waitFor(() => expect(datasource.migrateQuery).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(defaultProps.query));
  });

  it('should set a known query type', async () => {
    const query = createMockQuery();
    query.queryType = 'other' as QueryType;
    const onChange = jest.fn();

    render(<QueryEditor {...defaultProps} query={query} onChange={onChange} />);
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ queryType: QueryType.TIME_SERIES_LIST }))
    );
  });
});
