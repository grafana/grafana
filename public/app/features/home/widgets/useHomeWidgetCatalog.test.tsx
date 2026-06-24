import { renderHook } from '@testing-library/react';

import { type ComponentTypeWithExtensionMeta, PluginExtensionPoints } from '@grafana/data';
import { setPluginComponentsHook } from '@grafana/runtime';
import { contextSrv } from 'app/core/services/context_srv';
import { useIrmPlugin, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';
import { createComponentWithMeta } from 'app/features/plugins/extensions/usePluginComponents';

import { IncidentsCard } from '../AlertsIncidents/IncidentsCard';
import { OnCallCard } from '../AlertsIncidents/OnCallCard';

import { useHomeWidgetCatalog } from './useHomeWidgetCatalog';

jest.mock('@grafana/i18n', () => ({
  ...jest.requireActual('@grafana/i18n'),
  t: (_key: string, defaultValue: string) => defaultValue,
}));

jest.mock('app/features/alerting/unified/hooks/usePluginBridge', () => ({
  useIrmPlugin: jest.fn(),
  usePluginBridge: jest.fn(),
}));

const mockUseIrmPlugin = jest.mocked(useIrmPlugin);
const mockUsePluginBridge = jest.mocked(usePluginBridge);

function setPluginWidgets(components: Array<ComponentTypeWithExtensionMeta<{}>>) {
  setPluginComponentsHook(({ extensionPointId }) => ({
    isLoading: false,
    components: extensionPointId === PluginExtensionPoints.HomepageWidget ? components : [],
  }));
}

beforeEach(() => {
  setPluginWidgets([]);
  // Default: no curated plugin installed, alerting permission granted.
  mockUseIrmPlugin.mockReturnValue({ pluginId: SupportedPlugin.Irm, loading: false, installed: false });
  mockUsePluginBridge.mockReturnValue({ loading: false, installed: false });
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(true);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useHomeWidgetCatalog', () => {
  it('includes the always-available core built-ins', () => {
    const { result } = renderHook(() => useHomeWidgetCatalog());

    const ids = result.current.entries.map((e) => e.id);
    expect(ids).toEqual(expect.arrayContaining(['alerts', 'dashboards', 'quick-links']));
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
});
