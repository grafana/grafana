import { t } from '@grafana/i18n';
import { useIrmPlugin, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';
import { SupportedPlugin } from 'app/features/alerting/unified/types/pluginBridges';

import { IncidentsCard } from '../../AlertsIncidents/IncidentsCard';
import { KubernetesOverviewCard, KUBERNETES_APP_ID } from '../../AlertsIncidents/KubernetesOverviewCard';
import { OnCallCard } from '../../AlertsIncidents/OnCallCard';
import { type HomeWidgetCatalogEntry } from '../types';

/** Active incidents — gated on the IRM (or legacy Incident) plugin being installed. */
export function useIncidentsWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = useIrmPlugin(SupportedPlugin.Incident);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'incidents',
    title: t('home.widgets.incidents.title', 'Active incidents'),
    description: t('home.widgets.incidents.description', 'Incidents currently active in your IRM app'),
    icon: 'bell',
    source: 'curated',
    defaultSize: { w: 12, h: 8 },
    minSize: { w: 8, h: 6 },
    render: () => <IncidentsCard />,
  };
}

/** On-call shifts — gated on the IRM (or legacy OnCall) plugin being installed. */
export function useOnCallWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = useIrmPlugin(SupportedPlugin.OnCall);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'oncall',
    title: t('home.widgets.oncall.title', 'On-call shifts'),
    description: t('home.widgets.oncall.description', 'Who is on call right now'),
    icon: 'clock-nine',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <OnCallCard />,
  };
}

/** Kubernetes overview — gated on the Kubernetes Monitoring app being installed. */
export function useKubernetesWidget(): HomeWidgetCatalogEntry | null {
  const { loading, installed } = usePluginBridge(KUBERNETES_APP_ID);
  if (loading || !installed) {
    return null;
  }
  return {
    id: 'kubernetes',
    title: t('home.widgets.kubernetes.title', 'Kubernetes Monitoring'),
    description: t('home.widgets.kubernetes.description', 'Overview of clusters monitored by the Kubernetes app'),
    icon: 'kubernetes',
    source: 'curated',
    defaultSize: { w: 8, h: 6 },
    minSize: { w: 6, h: 4 },
    render: () => <KubernetesOverviewCard />,
  };
}
