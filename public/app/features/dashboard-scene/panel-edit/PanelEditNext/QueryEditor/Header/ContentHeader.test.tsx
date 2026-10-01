import { render, screen } from '@testing-library/react';

import {
  type DashboardQueryPolicy,
  type DataSourceInstanceSettings,
  type DataSourcePluginMeta,
  type ScopedVars,
} from '@grafana/data';
import { SceneDataTransformer, SceneGridLayout, SceneQueryRunner, SceneTimeRange, VizPanel } from '@grafana/scenes';
import { type DataQuery, type DataSourceRef } from '@grafana/schema';
import { mockDataSource } from 'app/features/alerting/unified/mocks';

import { DashboardScene } from '../../../../scene/DashboardScene';
import { DashboardGridItem } from '../../../../scene/layout-default/DashboardGridItem';
import { DefaultGridLayoutManager } from '../../../../scene/layout-default/DefaultGridLayoutManager';
import { QueryEditorType } from '../../constants';
import { renderWithQueryEditorProvider } from '../testUtils';

import { ContentHeader, ContentHeaderSceneWrapper } from './ContentHeader';

const RESTRICTED = 'restricted-datasource';

const mockSettings: Record<string, DataSourceInstanceSettings> = {
  'instance-a': mockDataSource({ uid: 'instance-a', type: RESTRICTED, name: 'instance-a' }, { id: RESTRICTED }),
  'instance-b': mockDataSource({ uid: 'instance-b', type: RESTRICTED, name: 'instance-b' }, { id: RESTRICTED }),
  prom: mockDataSource({ uid: 'prom', type: 'prometheus', name: 'prom' }, { id: 'prometheus' }),
};

// Capture the picker props so we can assert how `current`, `scopedVars` and `filter` are resolved.
const mockDataSourcePicker = jest.fn();

jest.mock('app/features/datasources/components/picker/DataSourcePicker', () => ({
  DataSourcePicker: (props: { current?: unknown; scopedVars?: unknown; filter?: unknown }) => {
    mockDataSourcePicker(props);
    return null;
  },
}));

// Reads from QueryEditor context, which is out of scope for these header wiring tests.
jest.mock('./HeaderActions', () => ({ HeaderActions: () => null }));

const resolvedSettings: DataSourceInstanceSettings = {
  uid: '${metrics_source}',
  name: '${metrics_source}',
  type: 'prometheus',
  meta: { id: 'prometheus', name: 'Prometheus' } as DataSourcePluginMeta,
  access: 'proxy',
  jsonData: {},
  readOnly: false,
};

function renderHeader(
  query: DataQuery,
  props: { currentDatasource?: DataSourceInstanceSettings; scopedVars?: ScopedVars } = {}
) {
  return render(
    <ContentHeader
      selectedAlert={null}
      selectedQuery={query}
      selectedTransformation={null}
      queries={[query]}
      cardType={QueryEditorType.Query}
      onChangeDataSource={jest.fn()}
      onUpdateQuery={jest.fn()}
      {...props}
    />
  );
}

const pickerProps = () => mockDataSourcePicker.mock.lastCall?.[0];

describe('ContentHeader datasource picker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the resolved effective datasource for an inherited query (parity with v1)', () => {
    // The query has no explicit ref, so the picker must show the resolved datasource (a
    // section-scoped variable here) rather than falling back to the default — matching v1.
    renderHeader({ refId: 'A' }, { currentDatasource: resolvedSettings });

    expect(pickerProps().current).toBe(resolvedSettings);
  });

  it('falls back to the raw query datasource ref when no resolved datasource is provided', () => {
    const queryRef = { uid: '${metrics_source}', type: 'prometheus' };
    renderHeader({ refId: 'A', datasource: queryRef });

    expect(pickerProps().current).toBe(queryRef);
  });

  it('forwards the scene scope so the picker can resolve section-scoped variables', () => {
    // Without this the picker only sees dashboard-level variables and renders "Select data source"
    // for a row/tab-scoped datasource variable.
    const scopedVars: ScopedVars = { __sceneObject: { value: {} } };
    renderHeader({ refId: 'A' }, { scopedVars });

    expect(pickerProps().scopedVars).toBe(scopedVars);
  });
});

describe('ContentHeader query name', () => {
  it('stays editable while a bulk selection is active', () => {
    // The header describes the active card only, so a bulk selection elsewhere in the sidebar
    // is no reason to lock renaming.
    const query = { refId: 'A' };
    renderWithQueryEditorProvider(<ContentHeaderSceneWrapper />, {
      queries: [query, { refId: 'B' }],
      selectedQuery: query,
      uiStateOverrides: { multiSelectMode: true, selectedQueryRefIds: ['A', 'B'] },
    });

    expect(screen.getByRole('button', { name: 'Edit query name' })).toBeInTheDocument();
  });
});

describe('ContentHeaderSceneWrapper dashboard query policies', () => {
  const policy: DashboardQueryPolicy = {
    restrictSamePluginToThisInstance: true,
    reason: 'Dashboard is bound to instance A.',
  };

  const datasource: DataSourceRef = { type: RESTRICTED, uid: 'instance-a' };
  const query: DataQuery = { refId: 'A', datasource };

  function buildPanelInDashboard(queryPolicies?: DashboardScene['state']['queryPolicies']) {
    const panel = new VizPanel({
      key: 'panel-1',
      pluginId: 'timeseries',
      $data: new SceneDataTransformer({
        transformations: [],
        $data: new SceneQueryRunner({ datasource, queries: [query] }),
      }),
    });

    new DashboardScene({
      uid: 'dash-1',
      title: 'Bound dashboard',
      queryPolicies,
      $timeRange: new SceneTimeRange({ from: 'now-6h', to: 'now' }),
      body: new DefaultGridLayoutManager({
        grid: new SceneGridLayout({ children: [new DashboardGridItem({ key: 'griditem-1', body: panel })] }),
      }),
    });

    return panel;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('hides data source instances the dashboard policy excludes from the query data source picker', () => {
    const panel = buildPanelInDashboard({ [RESTRICTED]: { uid: 'instance-a', policy } });

    renderWithQueryEditorProvider(<ContentHeaderSceneWrapper />, {
      queries: [query],
      selectedQuery: query,
      panelState: { panel },
    });

    const filter: ((ds: DataSourceInstanceSettings) => boolean) | undefined = pickerProps().filter;
    expect(filter).toBeDefined();
    expect(filter!(mockSettings['instance-b'])).toBe(false);
    expect(filter!(mockSettings['instance-a'])).toBe(true);
    expect(filter!(mockSettings['prom'])).toBe(true);
  });

  it('passes no filter when the dashboard has no policy', () => {
    const panel = buildPanelInDashboard(undefined);

    renderWithQueryEditorProvider(<ContentHeaderSceneWrapper />, {
      queries: [query],
      selectedQuery: query,
      panelState: { panel },
    });

    expect(pickerProps()).toBeDefined();
    expect(pickerProps().filter).toBeUndefined();
  });
});
