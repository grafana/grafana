import { useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type PluginMeta } from '@grafana/data';
import { Stack } from '@grafana/ui';
import { createBridgeURL } from 'app/features/alerting/unified/components/PluginBridge';
import { canAccessPluginPage, usePluginBridge } from 'app/features/alerting/unified/hooks/usePluginBridge';

import { ExistingSolutionCard } from './ExistingSolutionCard';
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
      details: ['web-03 critical at 96%, ~6 h to full'],
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
      details: ['checkout-service logs up 3x in the last hour'],
      action: 'View',
      href: '#',
    },
    action: 'Open Explore (Logs)',
    href: '#',
  },
];

export function RecommendationExisting() {
  const { settings, installed, loading: settingsLoading } = usePluginBridge(KUBERNETES_APP_ID);
  const [selectedTitle, setSelectedTitle] = useState<string>();

  if (settingsLoading) {
    return <RecommendationExistingSkeleton />;
  }

  const bridgePath = createBridgeURL(KUBERNETES_APP_ID, '/home');
  if (!installed || !settings || !canAccessPluginPage(settings, bridgePath)) {
    const selected = stubbedExisting.find((item) => item.title === selectedTitle) ?? stubbedExisting[0];
    return <ExistingSolutionCard existing={stubbedExisting} selected={selected} onSelect={setSelectedTitle} />;
  }

  return <LiveSolutionsCard settings={settings} selectedTitle={selectedTitle} onSelect={setSelectedTitle} />;
}

interface LiveSolutionsCardProps {
  settings: PluginMeta<{}>;
  selectedTitle: string | undefined;
  onSelect: (title: string) => void;
}

function LiveSolutionsCard({ settings, selectedTitle, onSelect }: LiveSolutionsCardProps) {
  const { datasource, resolving, resolutionError, inventory, inventoryLoading, health, cpuSeries, cpuLoading } =
    useKubernetesCardData();

  if (resolving) {
    return <RecommendationExistingSkeleton />;
  }

  const kubernetesItem =
    !resolutionError && datasource
      ? buildKubernetesItem(
          {
            inventory,
            inventoryLoading,
            health,
            cpuSeries: cpuSeries ?? null,
            cpuLoading,
            datasourceName: datasource.name,
          },
          settings
        )
      : null;

  const existing = kubernetesItem ? [kubernetesItem, ...stubbedExisting] : stubbedExisting;
  const selected = existing.find((item) => item.title === selectedTitle) ?? existing[0];
  return <ExistingSolutionCard existing={existing} selected={selected} onSelect={onSelect} />;
}

// Mirrors the card body (dropdown pill, icon + title, stats, CTA) while the Kubernetes lookups
// load, so the first paint never shows a solution that a resolving fetch would replace.
function RecommendationExistingSkeleton() {
  return (
    <Stack
      direction="column"
      justifyContent="space-between"
      gap={2}
      flex={1}
      data-testid="recommendation-existing-skeleton"
    >
      <Stack direction="column" gap={1.5}>
        <Skeleton width={240} height={30} />
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Skeleton width={44} height={44} />
          <Skeleton width={200} height={24} />
        </Stack>
      </Stack>

      <Stack direction="column" gap={0}>
        <Skeleton width={140} height={35} />
        <Skeleton width={100} height={20} />
      </Stack>

      <Stack direction="row" alignItems="center">
        <Skeleton width={170} height={32} />
      </Stack>
    </Stack>
  );
}
