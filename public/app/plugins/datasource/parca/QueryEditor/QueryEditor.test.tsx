import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';

import { CoreApp, DataSourcePluginMeta, PluginType } from '@grafana/data';
import { BackendSrv, getBackendSrv, setBackendSrv } from '@grafana/runtime';

import { ParcaDataSource } from '../datasource';
import { ProfileTypeMessage } from '../types';

import { Props, QueryEditor } from './QueryEditor';

describe('QueryEditor', () => {
  let origBackendSrv: BackendSrv;
  const fetchMock = jest.fn().mockReturnValue(of({ data: [] }));

  beforeEach(() => {
    origBackendSrv = getBackendSrv();
  });

  afterEach(() => {
    setBackendSrv(origBackendSrv);
  });

  it('should render without error', async () => {
    setup();

    expect(await screen.findByText(/process_cpu - cpu/)).toBeDefined();
  });

  it('should render options', async () => {
    setBackendSrv({ ...origBackendSrv, fetch: fetchMock });
    setup();
    await openOptions();
    expect(screen.getByText(/Metric/)).toBeDefined();
    expect(screen.getByText(/Profile/)).toBeDefined();
    expect(screen.getByText(/Both/)).toBeDefined();
  });

  it('should render correct options outside of explore', async () => {
    setBackendSrv({ ...origBackendSrv, fetch: fetchMock });
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
