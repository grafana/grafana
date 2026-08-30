import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import {
  ActionType,
  type DataSourceInstanceListItem,
  type DataSourcePluginMeta,
  type PluginMetaInfo,
  PluginType,
} from '@grafana/data';
import { config } from '@grafana/runtime';
import { getDataSourceInstanceList } from '@grafana/runtime/unstable';

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
    readOnly: false,
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
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    jest.mocked(getDataSourceInstanceList).mockReset();
    jest
      .mocked(getDataSourceInstanceList)
      .mockImplementation((filters) => Promise.resolve(allDataSources.filter((ds) => filters?.filter?.(ds))));
  });

  afterEach(() => {
    config.featureToggles = originalFeatureToggles;
  });

  it('renders the direct option for a Fetch action', () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: false };

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(screen.getByText('Direct from browser')).toBeInTheDocument();
  });

  it('does not query datasources when vizActionsAuth toggle is disabled', () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: false };

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(getDataSourceInstanceList).not.toHaveBeenCalled();
  });

  it('lists infinity datasources when vizActionsAuth toggle is enabled', async () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
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
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
    const onChange = jest.fn();

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={onChange} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'My Infinity');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ uid: 'infinity-uid-1', name: 'My Infinity' }));
  });

  it('calls onChange with "direct" when the direct option is selected', async () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
    const onChange = jest.fn();

    render(<ConnectionPicker actionType={ActionType.Infinity} datasourceUid="infinity-uid-1" onChange={onChange} />);

    await selectOptionInTest(screen.getByRole('combobox'), 'Direct from browser');

    expect(onChange).toHaveBeenCalledWith('direct');
  });
});
