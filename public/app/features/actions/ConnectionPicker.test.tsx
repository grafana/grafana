import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { selectOptionInTest } from 'test/helpers/selectOptionInTest';

import {
  ActionType,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type PluginMetaInfo,
  PluginType,
} from '@grafana/data';
import { config } from '@grafana/runtime';

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

function createDataSource(name: string, uid: string, dsType: string): DataSourceInstanceSettings {
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
    access: 'direct',
    jsonData: {},
    type: dsType,
    readOnly: false,
  };
}

const infinityDS1 = createDataSource('My Infinity', 'infinity-uid-1', INFINITY_DATASOURCE_TYPE);
const infinityDS2 = createDataSource('Second Infinity', 'infinity-uid-2', INFINITY_DATASOURCE_TYPE);
const otherDS = createDataSource('Other DS', 'other-uid', 'prometheus');

const allDataSources = [infinityDS1, infinityDS2, otherDS];

const getListMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: () => ({
    getList: getListMock,
  }),
}));

describe('ConnectionPicker', () => {
  const originalFeatureToggles = config.featureToggles;

  beforeEach(() => {
    getListMock.mockReset();
    // The component receives filtered results
    getListMock.mockImplementation(({ filter }: { filter: (ds: DataSourceInstanceSettings) => boolean }) =>
      allDataSources.filter((ds) => filter(ds))
    );
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

    expect(getListMock).not.toHaveBeenCalled();
  });

  it('lists infinity datasources when vizActionsAuth toggle is enabled', async () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
    const user = userEvent.setup();

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={jest.fn()} />);

    expect(getListMock).toHaveBeenCalled();
    const callArgs = getListMock.mock.calls[0][0];
    // Verify the picker filters to only infinity datasources.
    expect(callArgs.filter(infinityDS1)).toBe(true);
    expect(callArgs.filter(otherDS)).toBe(false);

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

  it('logs an error and does not call onChange when the selected datasource cannot be found', async () => {
    config.featureToggles = { ...originalFeatureToggles, vizActionsAuth: true };
    const onChange = jest.fn();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    render(<ConnectionPicker actionType={ActionType.Fetch} onChange={onChange} />);
    getListMock.mockImplementation(() => []);

    await selectOptionInTest(screen.getByRole('combobox'), 'My Infinity');

    expect(onChange).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'ConnectionPicker: Could not find datasource with UID:',
      'infinity-uid-1'
    );

    consoleErrorSpy.mockRestore();
  });
});
