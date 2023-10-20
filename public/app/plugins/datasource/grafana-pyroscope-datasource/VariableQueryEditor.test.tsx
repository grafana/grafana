import { render, screen } from '@testing-library/react';
import React from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { TemplateSrv } from 'app/features/templating/template_srv';

import { VariableQueryEditor } from './VariableQueryEditor';
import { PyroscopeDataSource } from './datasource';
import { PyroscopeDataSourceOptions } from './types';

describe('VariableQueryEditor', () => {
  it('renders correctly with type profileType', () => {
    render(
      <VariableQueryEditor
        datasource={getMockDatasource()}
        query={{
          refId: 'A',
          type: 'profileType',
        }}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText(/Query type/)).toBeInTheDocument();
  });

  it('renders correctly with type labels', async () => {
    render(
      <VariableQueryEditor
        datasource={getMockDatasource()}
        query={{
          refId: 'A',
          type: 'label',
          profileTypeId: 'profile:type:1',
        }}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText(/Query type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profile type/)).toBeInTheDocument();
    expect(await screen.findByDisplayValue(/profile-type/)).toBeInTheDocument();
  });

  it('renders correctly with type labelValue', async () => {
    render(
      <VariableQueryEditor
        datasource={getMockDatasource()}
        query={{
          refId: 'A',
          type: 'labelValue',
          labelName: 'foo',
          profileTypeId: 'cpu',
        }}
        onRunQuery={() => {}}
        onChange={() => {}}
      />
    );

    expect(screen.getByLabelText(/Query type/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Profile type/)).toBeInTheDocument();
    // using custom value for change
    expect(await screen.findByDisplayValue(/cpu/)).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(await screen.findByText(/foo/)).toBeInTheDocument();
  });
});

function getMockDatasource() {
  const ds = new PyroscopeDataSource({} as DataSourceInstanceSettings<PyroscopeDataSourceOptions>, new TemplateSrv());
  ds.getResource = jest.fn();
  (ds.getResource as jest.Mock).mockImplementation(async (type: string) => {
    if (type === 'profileTypes') {
      return [
        { label: 'profile type 1', id: 'profile:type:1' },
        { label: 'profile type 2', id: 'profile:type:2' },
        { label: 'profile type 3', id: 'profile:type:3' },
      ];
    }
    if (type === 'labelNames') {
      return ['foo', 'bar'];
    }

    return ['val1', 'val2'];
  });
  return ds;
}
