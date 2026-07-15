import { useState } from 'react';

import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { ExistingSolutionCard } from './ExistingSolutionCard';
import { RecommendationExistingSkeleton } from './RecommendationExistingSkeleton';
import { buildKubernetesItem } from './buildKubernetesItem';
import { KUBERNETES_APP_ID } from './kubernetesData';
import { type ExistingItem } from './types';
import { useKubernetesCardData } from './useKubernetesCardData';

const stubbedExisting: ExistingItem[] = [
  {
    title: 'Hosted Metrics',
    icon: 'chart-line',
    stats: {
      primary: '4.2M series',
      secondary: '12 hosts',
    },
    alert: {
      primary: '3 hosts above 90% disk',
      secondary: ['web-03 critical at 96%, ~6 h to full'],
      action: 'View',
      href: '#',
    },
    action: 'Open infrastructure',
    href: '#',
  },
  {
    title: 'Hosted Logs',
    icon: 'file-alt',
    stats: {
      primary: '47 GB ingested',
      secondary: '8 sources',
    },
    alert: {
      primary: 'Ingest spike detected',
      secondary: ['checkout-service logs up 3x in the last hour'],
      action: 'View',
      href: '#',
    },
    action: 'Open Explore (Logs)',
    href: '#',
  },
];

export function RecommendationExisting() {
  const { settings, loading: settingsLoading } = usePluginBridge(KUBERNETES_APP_ID);
  const { datasource, resolving, resolutionError, inventory, inventoryLoading, health, cpuSeries, cpuLoading } =
    useKubernetesCardData();

  const [selectedTitle, setSelectedTitle] = useState<string>();

  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  const canAccessK8s = settings && canAccessPluginPage(settings, bridgePath);

  if (!settingsLoading && !canAccessK8s) {
    const existing = stubbedExisting;
    const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];
    return <ExistingSolutionCard existing={existing} selected={selected} onSelect={setSelectedTitle} />;
  }

  if (settingsLoading || resolving) {
    return <RecommendationExistingSkeleton />;
  }

  let kubernetesItem: ExistingItem | null = null;
  if (!resolutionError && datasource && settings) {
    kubernetesItem = buildKubernetesItem(
      {
        inventory,
        inventoryLoading,
        health,
        cpuSeries: cpuSeries ?? null,
        cpuLoading,
        datasourceName: datasource.name,
      },
      settings
    );
  }

  const existing = kubernetesItem ? [kubernetesItem, ...stubbedExisting] : stubbedExisting;
  const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];

  return <ExistingSolutionCard existing={existing} selected={selected} onSelect={setSelectedTitle} />;
}
