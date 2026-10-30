import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type PluginMetaInfo,
  PluginType,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { type DataSourceSrv, setDataSourceSrv } from '@grafana/runtime';
import { mockBoundingClientRect } from '@grafana/test-utils';

// Imported eagerly so the shim's lazy import resolves from the module cache, keeping the
// Suspense fallback -> core picker transition fast enough for the tests under parallel workers
import './DataSourcePicker';
import { RuntimeDataSourcePickerShim } from './RuntimeDataSourcePickerShim';

const pluginMetaInfo: PluginMetaInfo = {
  author: { name: '' },
  description: '',
  screenshots: [],
  version: '',
  updated: '',
  links: [],
  logos: { small: '', large: '' },
};

function createDS(name: string): DataSourceInstanceSettings {
  const meta: DataSourcePluginMeta = {
    builtIn: false,
    name,
    id: name,
    type: PluginType.datasource,
    baseUrl: '',
    info: pluginMetaInfo,
    module: '',
  };
  return { name, uid: name + '-uid', meta, access: 'direct', jsonData: {}, type: '', readOnly: true };
}

const mockDS = createDS('mock.datasource');

const getListMock = jest.fn();
const getInstanceSettingsMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getTemplateSrv: () => ({
    getVariables: () => [],
  }),
}));

jest.mock('../../hooks', () => {
  const actual = jest.requireActual('../../hooks');
  return {
    ...actual,
    useRecentlyUsedDataSources: () => [[], jest.fn()],
    useDatasources: () => [mockDS],
  };
});

// Only the legacy picker renders this labelled container
const legacyPicker = () => screen.queryByLabelText('Data source picker select container');

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
  mockBoundingClientRect();
  setDataSourceSrv({
    getList: getListMock,
    getInstanceSettings: getInstanceSettingsMock,
  } as unknown as DataSourceSrv);
});

beforeEach(() => {
  jest.clearAllMocks();
  getListMock.mockReturnValue([mockDS]);
  getInstanceSettingsMock.mockReturnValue(mockDS);
});

describe('RuntimeDataSourcePickerShim', () => {
  it('should render the core picker', async () => {
    render(<RuntimeDataSourcePickerShim onChange={jest.fn()} current={mockDS.uid} />);

    // A skeleton renders as the Suspense fallback until the core picker chunk loads
    const input = await screen.findByTestId(selectors.components.DataSourcePicker.inputV2, undefined, {
      timeout: 3000,
    });
    expect(input).toHaveAttribute('placeholder', mockDS.name);
    expect(legacyPicker()).not.toBeInTheDocument();
  });

  it('should accept the full runtime prop contract without errors', async () => {
    const onClear = jest.fn();
    render(
      <RuntimeDataSourcePickerShim
        onChange={jest.fn()}
        current={mockDS.uid}
        onClear={onClear}
        invalid
        isLoading={false}
        onBlur={jest.fn()}
        autoFocus
        openMenuOnFocus
        placeholder="pick one"
        width={20}
      />
    );

    const input = await screen.findByTestId(selectors.components.DataSourcePicker.inputV2, undefined, {
      timeout: 3000,
    });
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'Clear data source' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
