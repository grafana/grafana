import { act, render } from '@testing-library/react';
import { makeDataSourceSettings } from 'test/helpers/makeDataSourceSettings';
import {
  type DataSourceFallbackWatcher,
  seedDataSources,
  watchDataSourceFallbacks,
} from 'test/helpers/seedDataSources';
import { MockDataSourceApi } from 'test/mocks/datasource_srv';

import { DashboardAnnotationsDataLayer } from './DashboardAnnotationsDataLayer';
import { DashboardDataLayerControls } from './DashboardDataLayerControls';
import { DashboardDataLayerSet } from './DashboardDataLayerSet';
import { DashboardScene } from './DashboardScene';

beforeEach(() => {
  const settings = makeDataSourceSettings('default-ds', 'Default', 'default-ds-type', { isDefault: true });
  seedDataSources([{ settings, api: new MockDataSourceApi(settings) }], { legacySrv: 'mock' });
});

async function renderDataLayerControls(annotationLayers: DashboardAnnotationsDataLayer[]) {
  const dashboardScene = new DashboardScene({
    $data: new DashboardDataLayerSet({ annotationLayers }),
  });

  let renderResult!: ReturnType<typeof render>;

  await act(async () => {
    renderResult = render(<DashboardDataLayerControls dashboard={dashboardScene} />);
  });

  return {
    ...renderResult,
  };
}

let dataSourceFallbacks: DataSourceFallbackWatcher;

beforeEach(() => {
  dataSourceFallbacks = watchDataSourceFallbacks();
});

afterEach(() => {
  dataSourceFallbacks.expectNoFallbacks(['instance', 'settings', 'list']);
});

describe('<DashboardDataLayerControls />', () => {
  test('renders only visible annotations layers that are not in the controls menu', async () => {
    const { queryByText } = await renderDataLayerControls([
      // hidden
      new DashboardAnnotationsDataLayer({
        name: 'test-ann1',
        isHidden: true,
        isEnabled: true,
        query: {
          name: 'test-query1',
          enable: true,
          iconColor: 'red',
        },
      }),
      // in controls menu
      new DashboardAnnotationsDataLayer({
        name: 'test-ann2',
        isHidden: false,
        placement: 'inControlsMenu',
        isEnabled: true,
        query: {
          name: 'test-query2',
          enable: true,
          iconColor: 'green',
        },
      }),
      // visible
      new DashboardAnnotationsDataLayer({
        name: 'test-ann3',
        isHidden: false,
        placement: undefined,
        isEnabled: true,
        query: {
          name: 'test-query2',
          enable: true,
          iconColor: 'blue',
        },
      }),
      // visible and disabled
      new DashboardAnnotationsDataLayer({
        name: 'test-ann4',
        isHidden: false,
        placement: undefined,
        isEnabled: false,
        query: {
          name: 'test-query4',
          enable: true,
          iconColor: 'purple',
        },
      }),
    ]);

    expect(queryByText('test-ann1')).not.toBeInTheDocument();
    expect(queryByText('test-ann2')).not.toBeInTheDocument();
    expect(queryByText('test-ann3')).toBeInTheDocument();
    expect(queryByText('test-ann4')).toBeInTheDocument();
  });
});
