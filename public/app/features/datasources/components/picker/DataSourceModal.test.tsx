import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type GrafanaConfig,
  type PluginMetaInfo,
  PluginType,
  locationUtil,
} from '@grafana/data';
import { mockBoundingClientRect } from '@grafana/test-utils';

import { DataSourceModal, type DataSourceModalProps } from './DataSourceModal';

const pluginMetaInfo: PluginMetaInfo = {
  author: { name: '' },
  description: '',
  screenshots: [],
  version: '',
  updated: '',
  links: [],
  logos: { small: '', large: '' },
};

function createPluginMeta(name: string, builtIn: boolean): DataSourcePluginMeta {
  return { builtIn, name, id: name, type: PluginType.datasource, baseUrl: '', info: pluginMetaInfo, module: '' };
}

function createDS(name: string, id: number, builtIn: boolean): DataSourceInstanceSettings {
  return {
    name: name,
    uid: name + 'uid',
    meta: createPluginMeta(name, builtIn),
    access: 'direct',
    jsonData: {},
    type: '',
    readOnly: true,
  };
}

const mockDS1 = createDS('mock.datasource.1', 1, false);
const mockDS2 = createDS('mock.datasource.2', 2, false);
const mockDSBuiltIn = createDS('mock.datasource.builtin', 3, true);

const mockDSList = [mockDS1, mockDS2, mockDSBuiltIn];

beforeAll(() => {
  mockBoundingClientRect();
});

const setup = (partialProps: Partial<DataSourceModalProps> = {}) => {
  window.HTMLElement.prototype.scrollIntoView = function () {};

  const props: DataSourceModalProps = {
    ...partialProps,
    onChange: partialProps.onChange || jest.fn(),
    onDismiss: partialProps.onDismiss || jest.fn(),
    current: partialProps.current || mockDS1,
  };

  return render(<DataSourceModal {...props} />);
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => {
    return {
      getVariables: () => [],
    };
  },
  getDataSourceSrv: () => ({
    getList: getListMock,
    getInstanceSettings: getInstanceSettingsMock,
  }),
}));

locationUtil.initialize({
  config: { appSubUrl: '/my-sub-path' } as GrafanaConfig,
  getTimeRangeForUrl: jest.fn(),
  getVariablesUrlParams: jest.fn(),
});

const getListMock = jest.fn();
const getInstanceSettingsMock = jest.fn();
beforeEach(() => {
  getListMock.mockReturnValue(mockDSList);
  getInstanceSettingsMock.mockReturnValue(mockDS1);
});

function createMockDSList(count: number) {
  return Array.from({ length: count }, (_, i) => createDS(`datasource-${i}`, i, false));
}

describe('DataSourceDropdown', () => {
  it('should render', () => {
    expect(() => setup()).not.toThrow();
  });

  describe('configuration', () => {
    it('displays the configure new datasource when the list is empty', async () => {
      const user = userEvent.setup();
      setup();
      const searchBox = await screen.findByRole('searchbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);
      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(screen.queryAllByText('Configure a new data source')).toHaveLength(2);
      screen.queryAllByRole('link').forEach((link) => {
        // It should point to the new data source page including any sub url configured
        expect(link).toHaveAttribute('href', '/my-sub-path/connections/datasources/new');
      });
    });

    it('should fetch the DS applying the correct filters consistently across lists', async () => {
      const filters = {
        mixed: true,
        tracing: true,
        dashboard: true,
        metrics: true,
        type: 'foo',
        annotations: true,
        variables: true,
        alerting: true,
        pluginId: 'pluginid',
        logs: true,
      };

      const props = {
        onChange: () => {},
        onDismiss: () => {},
        current: mockDS1.name,
        ...filters,
        dataSources: mockDSList,
      };

      getListMock.mockClear();
      render(<DataSourceModal {...props}></DataSourceModal>);

      // Every call to the service must contain same filters
      expect(getListMock).toHaveBeenCalled();
      getListMock.mock.calls.forEach((call) =>
        expect(call[0]).toMatchObject({
          ...filters,
        })
      );
    });
  });

  describe('interactions', () => {
    it('should be searchable', async () => {
      const user = userEvent.setup();
      setup();
      const searchBox = await screen.findByRole('searchbox');
      expect(searchBox).toBeInTheDocument();
      await user.click(searchBox!);

      await user.keyboard(mockDS2.name); //Search for xMockDS

      expect(screen.queryByText(mockDS1.name, { selector: 'span' })).toBeNull();
      expect(await screen.findByText(mockDS2.name, { selector: 'span' })).toBeInTheDocument();

      await user.keyboard('foobarbaz'); //Search for a DS that should not exist

      expect(await screen.findByText('No data sources found')).toBeInTheDocument();
    });

    it('should call the onChange handler with the correct datasource', async () => {
      const user = userEvent.setup();
      const onChange = jest.fn();
      setup({ onChange });
      await user.click(await screen.findByText(mockDS2.name, { selector: 'span' }));
      expect(onChange.mock.lastCall[0].name).toEqual(mockDS2.name);
    });
  });
});

describe('DataSourceDropdown with virtualized list', () => {
  const largeMockDSList = createMockDSList(100);

  beforeEach(() => {
    getListMock.mockReturnValue(largeMockDSList);
    getInstanceSettingsMock.mockReturnValue(largeMockDSList[0]);
  });

  it('should render without errors', () => {
    expect(() => setup({ current: largeMockDSList[0] })).not.toThrow();
  });

  it('should render only a subset of items in the DOM', async () => {
    setup({ current: largeMockDSList[0] });
    const cards = await screen.findAllByTestId('data-source-card');
    expect(cards.length).toBeGreaterThan(0);
    expect(cards.length).toBeLessThan(100);
  });

  it('should call onChange when a visible data source is clicked', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    setup({ onChange, current: largeMockDSList[0] });

    const cards = await screen.findAllByTestId('data-source-card');
    const button = cards[1].querySelector('button')!;
    await user.click(button);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('should be searchable', async () => {
    const user = userEvent.setup();
    setup({ current: largeMockDSList[0] });
    const searchBox = await screen.findByRole('searchbox');
    await user.click(searchBox);

    await user.keyboard('datasource-50');

    expect(await screen.findByText('datasource-50', { selector: 'span' })).toBeInTheDocument();
    const cards = screen.getAllByTestId('data-source-card');
    // Search should narrow the list significantly
    expect(cards.length).toBeLessThan(10);
  });

  it('should display empty state when search has no results', async () => {
    const user = userEvent.setup();
    setup({ current: largeMockDSList[0] });
    const searchBox = await screen.findByRole('searchbox');
    await user.click(searchBox);

    await user.keyboard('nonexistent-datasource-xyz');

    expect(await screen.findByText('No data sources found')).toBeInTheDocument();
  });
});
