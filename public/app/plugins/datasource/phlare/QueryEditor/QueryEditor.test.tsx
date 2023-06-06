import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { CoreApp, PluginType } from '@grafana/data';

import { PhlareDataSource } from '../datasource';
import { ProfileTypeMessage } from '../types';

import { Props, QueryEditor } from './QueryEditor';

describe('QueryEditor', () => {
  it('should render without error', async () => {
    setup();

    expect(await screen.findByText('process_cpu - cpu')).toBeDefined();
  });

  it('should render options', async () => {
    setup();
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();

    expect(screen.getByText(/Group by/)).toBeDefined();
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
  const ds = new PhlareDataSource({
    name: 'test',
    uid: 'test',
    type: PluginType.datasource,
    access: 'proxy',
    id: 1,
    jsonData: {},
    meta: {
      name: '',
      id: '',
      type: PluginType.datasource,
      baseUrl: '',
      info: {
        author: {
          name: '',
        },
        description: '',
        links: [],
        logos: {
          large: '',
          small: '',
        },
        screenshots: [],
        updated: '',
        version: '',
      },
      module: '',
    },
    readOnly: false,
  });

  ds.getProfileTypes = jest.fn().mockResolvedValue([
    {
      label: 'process_cpu - cpu',
      id: 'process_cpu:cpu',
    },
    {
      label: 'memory',
      id: 'memory:memory',
    },
  ] as ProfileTypeMessage[]);

  const utils = render(
    <QueryEditor
      query={{
        queryType: 'both',
        labelSelector: '',
        profileTypeId: 'process_cpu:cpu',
        refId: 'A',
        maxNodes: 1000,
        groupBy: [],
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
