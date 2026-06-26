import { renderHook } from '@testing-library/react';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { getDataSourceSrv, setPluginComponentsHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { useIrmPlugin, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { HostedLogsCard } from '../AlertsIncidents/HostedLogsCard';
import { HostedMetricsCard } from '../AlertsIncidents/HostedMetricsCard';
import { IncidentsCard } from '../AlertsIncidents/IncidentsCard';
import { KubernetesOverviewCard } from '../AlertsIncidents/KubernetesOverviewCard';
import { OnCallCard } from '../AlertsIncidents/OnCallCard';
import { SlosCard } from '../AlertsIncidents/SlosCard';

import { useHomeWidgetCatalog } from './useHomeWidgetCatalog';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  useIrmPlugin: jest.fn(),
  usePluginBridge: jest.fn(),
}));

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getDataSourceSrv: jest.fn(),
}));

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);
const mockUsePluginBridge = jest.mocked(usePluginBridge);
const mockGetDataSourceSrv = jest.mocked(getDataSourceSrv);

function setPluginWidgets(components: Array<ComponentTypeWithExtensionMeta<{}>>) {
  setPluginComponentsHook(({ extensionPointId }) => ({
    isLoading: false,
    components: extensionPointId === PluginExtensionPoints.HomepageWidget ? components : [],
  }));
}

// getList is the only DataSourceSrv method the gate hooks touch; filter by the requested `type` so
// a single list can model "only Prometheus present", "only Loki present", etc.
function setDataSources(list: Array<{ uid: string; type: string }> = []) {
  mockGetDataSourceSrv.mockReturnValue({
    getList: (filter?: { type?: string }) => (filter?.type ? list.filter((d) => d.type === filter.type) : list),
  } as unknown as ReturnType<typeof getDataSourceSrv>);
}

beforeEach(() => {
  setPluginWidgets([]);
  // Default: no curated plugin installed, alerting permission granted.
  mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Irm, loading: false, installed: false });
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: false });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
  setDataSources([]);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useHomeWidgetCatalog', () => {
  it('includes the always-available core built-ins', () => {
    const { result } = renderHook(() => useHomeWidgetCatalog());

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['alerts', 'dashboards']));
    expect(result.current.entries.find((e) => e.id === 'dashboards')?.source).toBe('core');
  });

  it('omits the alerts widget when the user lacks alerting permission', () => {
    jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(false);

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).not.toContain('alerts');
    expect(ids).toContain('dashboards'); // unconditionally available
  });

  it('omits curated widgets when their backing plugin is not installed', () => {
    const { result } = renderHook(() => useHomeWidgetCatalog());

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).not.toContain('incidents');
    expect(ids).not.toContain('oncall');
    expect(ids).not.toContain('kubernetes');
  });

  it('includes curated widgets when the IRM plugin is installed', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Irm, loading: false, installed: true });
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: true });

    const { result } = renderHook(() => useHomeWidgetCatalog());

    for (const id of ['incidents', 'oncall']) {
      expect(result.current.entries.find((e) => e.id === id)?.source).toBe('curated');
    }
    // The investigations widget was removed; it must not appear even when IRM is installed.
    expect(result.current.entries.map((e) => e.id)).not.toContain('investigations');
  });

  it('wires the incidents widget to the live IncidentsCard when installed', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Irm, loading: false, installed: true });

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const incidents = result.current.entries.find((e) => e.id === 'incidents');
    // The incidents widget surfaces the live IncidentsCard, not a CTA link card.
    expect(incidents?.render()).toEqual(<IncidentsCard />);
  });

  it('wires the on-call widget to the live OnCallCard when installed', () => {
    mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Irm, loading: false, installed: true });

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const oncall = result.current.entries.find((e) => e.id === 'oncall');
    // The on-call widget surfaces the live OnCallCard, not a CTA link card.
    expect(oncall?.render()).toEqual(<OnCallCard />);
  });

  it('wires the kubernetes widget to the live KubernetesOverviewCard when the app is installed', () => {
    // The kubernetes widget gates on the k8s app via usePluginBridge, independent of IRM.
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: true });

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const kubernetes = result.current.entries.find((e) => e.id === 'kubernetes');
    expect(kubernetes?.source).toBe('curated');
    expect(kubernetes?.render()).toEqual(<KubernetesOverviewCard />);
    // IRM-gated widgets stay absent: the k8s app being installed must not surface incidents/oncall.
    expect(result.current.entries.map((e) => e.id)).toEqual(expect.not.arrayContaining(['incidents', 'oncall']));
  });

  it('surfaces open plugin-extension widgets keyed by their stable meta.id', () => {
    const pluginWidget = createComponentWithMeta(
      {
        pluginId: 'myorg-app',
        title: 'My plugin widget',
        description: 'Provided by a plugin',
        component: () => null,
      },
      PluginExtensionPoints.HomepageWidget
    );
    setPluginWidgets([pluginWidget]);

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const entry = result.current.entries.find((e) => e.source === 'plugin');
    expect(entry?.id).toBe(pluginWidget.meta.id);
    expect(entry?.title).toBe('My plugin widget');
    expect(entry?.description).toBe('Provided by a plugin');
  });

  it('includes the hosted-metrics widget when a Prometheus datasource is configured', () => {
    setDataSources([{ uid: 'prom', type: 'prometheus' }]);

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const metrics = result.current.entries.find((e) => e.id === 'hosted-metrics');
    expect(metrics?.source).toBe('curated');
    expect(metrics?.render()).toEqual(<HostedMetricsCard />);
    // The Loki-gated logs widget stays absent when only Prometheus is present.
    expect(result.current.entries.map((e) => e.id)).not.toContain('hosted-logs');
  });

  it('includes the hosted-logs widget when a Loki datasource is configured', () => {
    setDataSources([{ uid: 'loki', type: 'loki' }]);

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const logs = result.current.entries.find((e) => e.id === 'hosted-logs');
    expect(logs?.source).toBe('curated');
    expect(logs?.render()).toEqual(<HostedLogsCard />);
    expect(result.current.entries.map((e) => e.id)).not.toContain('hosted-metrics');
  });

  it('includes the slos widget when the SLO app is installed', () => {
    mockUsePluginBridge.mockReturnValue({ loading: false, installed: true });

    const { result } = renderHook(() => useHomeWidgetCatalog());

    const slos = result.current.entries.find((e) => e.id === 'slos');
    expect(slos?.source).toBe('curated');
    expect(slos?.render()).toEqual(<SlosCard />);
  });

  it('omits the datasource- and slo-gated widgets when their sources are absent', () => {
    const { result } = renderHook(() => useHomeWidgetCatalog());

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).not.toContain('hosted-metrics');
    expect(ids).not.toContain('hosted-logs');
    expect(ids).not.toContain('slos');
  });
});
