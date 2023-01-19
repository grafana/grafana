import { screen } from '@testing-library/dom';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, DataSourcePluginMeta, PluginType } from '@grafana/data';

import { ParcaDataSource } from '../datasource';
import { ProfileTypeMessage } from '../types';

import { Props, QueryEditor } from './QueryEditor';

describe('QueryEditor', () => {
  it('should render without error', async () => {
    setup();

    expect(screen.findByText('process_cpu:cpu')).toBeDefined();
  });

  it('should render options', async () => {
    setup();
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should render correct options outside of explore', async () => {
    setup({ props: { app: CoreApp.Dashboard } });
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.queryAllByText(/Both/).length).toBe(0);
  });
});

async function openOptions() {
  const options = screen.getByText(/Options/);
  expect(options).toBeDefined();
  await userEvent.click(options);
}

function setup(options: { props: Partial<Props> } = { props: {} }) {
  const onChange = jest.fn();
  const ds = new ParcaDataSource({
    name: 'test',
    uid: 'test',
    type: PluginType.datasource,
    access: 'proxy',
    id: 1,
    jsonData: {},
    meta: {} as unknown as DataSourcePluginMeta,
    readOnly: false,
  });

  ds.getProfileTypes = jest.fn().mockResolvedValue([
    {
      name: 'process_cpu',
      ID: 'process_cpu:cpu',
      period_type: 'day',
      period_unit: 's',
      sample_unit: 'ms',
      sample_type: 'cpu',
    },
    {
      name: 'memory',
      ID: 'memory:memory',
      period_type: 'day',
      period_unit: 's',
      sample_unit: 'ms',
      sample_type: 'memory',
    },
  ] as ProfileTypeMessage[]);

  const utils = render(
    <QueryEditor
      query={{
        queryType: 'both',
        labelSelector: '',
        profileTypeId: 'process_cpu:cpu',
        refId: 'A',
      }}
      datasource={ds}
      onChange={onChange}
      onRunQuery={() => {}}
      app={CoreApp.Explore}
      {...options.props}
    />
  );
  return { ...utils, onChange };
}
