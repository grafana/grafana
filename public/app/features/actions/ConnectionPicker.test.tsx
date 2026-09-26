import { act, cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';
import { render } from 'test/test-utils';

import {
  ActionType,
  type DataSourceInstanceListItem,
  type DataSourcePluginMeta,
  type PluginMetaInfo,
  PluginType,
} from '@grafana/data';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { ConnectionPicker } from './ConnectionPicker';
import { INFINITY_DATASOURCE_TYPE } from './utils';

const pluginMetaInfo: PluginMetaInfo = {
  author: { name: '' },
  description: '',
  screenshots: [],
  version: '',
  updated: '',
  links: [],
  logos: { small: 'small-logo.svg', large: 'large-logo.svg' },
};

function createDataSource(name: string, uid: string, dsType: string): DataSourceInstanceListItem {
  const meta: DataSourcePluginMeta = {
    builtIn: false,
    name,
    id: name,
    type: PluginType.datasource,
    baseUrl: '',
    info: pluginMetaInfo,
    module: '',
  };
  return {
    name,
    uid,
    meta,
    isDefault: false,
    type: dsType,
  };
}

const infinityDS1 = createDataSource('My Infinity', 'infinity-uid-1', INFINITY_DATASOURCE_TYPE);
const infinityDS2 = createDataSource('Second Infinity', 'infinity-uid-2', INFINITY_DATASOURCE_TYPE);
const otherDS = createDataSource('Other DS', 'other-uid', 'prometheus');

const allDataSources = [infinityDS1, infinityDS2, otherDS];

jest.mock('@grafana/runtime/unstable', () => ({
  ...jest.requireActual('@grafana/runtime/unstable'),
  getDataSourceInstanceList: jest.fn(),
}));

describe('ConnectionPicker', () => {
  beforeEach(() => {
    jest.mocked(getDataSourceInstanceList).mockReset();
    jest
      .mocked(getDataSourceInstanceList)
      .mockImplementation((filters) => Promise.resolve(allDataSources.filter((ds) => filters?.filter?.(ds))));
  });

  afterEach(() => {
    cleanup();
    setTestFlags({});
  });

  it('renders the direct option for a Fetch action', () => {
    setTestFlags({ vizActionsAuth: false });

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(screen.getByText('Direct from browser')).toBeInTheDocument();
  });

  it('does not query datasources when vizActionsAuth toggle is disabled', () => {
    setTestFlags({ vizActionsAuth: false });

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(screen.getByText('Direct from browser')).toBeInTheDocument();
    expect(getDataSourceInstanceList).not.toHaveBeenCalled();
  });

  it('lists infinity datasources when vizActionsAuth toggle is enabled', async () => {
    setTestFlags({ vizActionsAuth: true });
    const user = userEvent.setup();

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(getDataSourceInstanceList).toHaveBeenCalled();
    const callArgs = jest.mocked(getDataSourceInstanceList).mock.calls[0][0]!;
    // Verify the picker filters to only infinity datasources.
    expect(callArgs.filter!(infinityDS1)).toBe(true);
    expect(callArgs.filter!(otherDS)).toBe(false);

    const select = screen.getByRole('combobox');
    await user.click(select);

    expect((await screen.findAllByText('Direct from browser')).length).toBeGreaterThan(0);
    expect(await screen.findByText('My Infinity')).toBeInTheDocument();
    expect(await screen.findByText('Second Infinity')).toBeInTheDocument();
  });

  it('calls onChange with the selected DataSourceInstanceSettings when an infinity datasource is picked', async () => {
    setTestFlags({ vizActionsAuth: true });
    const onChange = jest.fn();

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={onChange} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'My Infinity');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: 'infinity-uid-1', name: 'My Infinity' }));
  });

  it('calls onChange with "direct" when the direct option is selected', async () => {
    setTestFlags({ vizActionsAuth: true });
    const onChange = jest.fn();

    render(<ConnectionPicker actionType={ActionType.Infinity} datasourceUid="infinity-uid-1" onChange={onChange} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'Direct from browser');

    expect(onChange).toHaveBeenCalledWith('direct');
  });

  it('updates available connections when the flag changes', async () => {
    setTestFlags({ vizActionsAuth: false });
    const { user } = render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(screen.getByText('Direct from browser')).toBeInTheDocument();
    expect(getDataSourceInstanceList).not.toHaveBeenCalled();

    await act(async () => setTestFlags({ vizActionsAuth: true }));
    await user.click(screen.getByRole('combobox'));
    expect(await screen.findByText('My Infinity')).toBeInTheDocument();

    await act(async () => setTestFlags({ vizActionsAuth: false }));
    expect(screen.getByRole('option', { name: /Direct from browser/ })).toBeInTheDocument();
    expect(screen.queryByText('My Infinity')).not.toBeInTheDocument();
  });

  it('keeps datasource options hidden when the flag is disabled during loading', async () => {
    setTestFlags({ vizActionsAuth: true });
    let resolveDataSources!: (dataSources: DataSourceInstanceListItem[]) => void;
    jest.mocked(getDataSourceInstanceList).mockReturnValue(
      new Promise((resolve) => {
        resolveDataSources = resolve;
      })
    );
    const { user } = render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    await act(async () => setTestFlags({ vizActionsAuth: false }));
    await act(async () => resolveDataSources([infinityDS1]));
    await user.click(screen.getByRole('combobox'));

    expect(screen.getByRole('option', { name: /Direct from browser/ })).toBeInTheDocument();
    expect(screen.queryByText('My Infinity')).not.toBeInTheDocument();
  });
});
