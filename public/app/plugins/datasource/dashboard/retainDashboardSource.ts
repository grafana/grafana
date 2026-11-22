import { type SceneDataProvider, type SceneObject, SceneQueryRunner, type VizPanel } from '@grafana/scenes';
import { getQueryRunnerFor } from 'app/features/dashboard-scene/utils/getQueryRunnerFor';
import { activateSceneObjectAndParentTree } from 'app/features/dashboard-scene/utils/utils';

interface SourceUsage {
  users: number;
  releaseAncestors?: () => void;
}

const activeSources = new WeakMap<SceneDataProvider, SourceUsage>();

// Both the request and the consumer can hold this source. Each owns its own activation.
function retainDashboardSource(panel: VizPanel, provider: SceneDataProvider): () => void {
  const runner = getQueryRunnerFor(panel);
  const visibility = runner ?? provider;
  const usage = activeSources.get(visibility) ?? { users: 0 };
  const needsFallbackWidth = !provider.isActive;
  if (++usage.users === 1) {
    activeSources.set(visibility, usage);
    visibility.bypassIsInViewChanged?.(true);
    usage.releaseAncestors = panel.parent && activateSceneObjectAndParentTree(panel.parent);
  }

  const releasePanel = panel.activate();
  const panelData = panel.state.$data;
  const releasePanelData = panelData !== provider ? panelData?.activate() : undefined;
  const releaseProvider = provider.activate();
  const releaseRunner = runner !== provider ? runner?.activate() : undefined;

  // Let activation skip width-dependent queries so the width update starts them only once.
  if (needsFallbackWidth) {
    provider.setContainerWidth?.(500);
  }

  return () => {
    const lastUser = --usage.users === 0;
    if (lastUser) {
      activeSources.delete(visibility);
      visibility.bypassIsInViewChanged?.(false);
    }
    releaseRunner?.();
    releaseProvider();
    releasePanelData?.();
    releasePanel();
    if (lastUser) {
      usage.releaseAncestors?.();
    }
  };
}

const consumers = new WeakMap<SceneQueryRunner, Map<SceneQueryRunner, () => void>>();

export function registerDashboardSourceConsumer(runner: SceneQueryRunner): () => void {
  const sources = new Map<SceneQueryRunner, () => void>();
  consumers.set(runner, sources);
  return () => {
    consumers.delete(runner);
    sources.forEach((release) => release());
  };
}

function dependsOn(source: SceneQueryRunner, consumer: SceneQueryRunner, seen = new Set<SceneQueryRunner>()): boolean {
  if (source === consumer) {
    return true;
  }
  if (seen.has(source)) {
    return false;
  }

  seen.add(source);
  return Array.from(consumers.get(source)?.keys() ?? []).some((runner) => dependsOn(runner, consumer, seen));
}

export function retainDashboardSourceForRequest(
  consumer: SceneObject,
  panel: VizPanel,
  provider: SceneDataProvider
): (() => void) | undefined {
  const source = getQueryRunnerFor(panel);
  if (consumer instanceof SceneQueryRunner && source && dependsOn(source, consumer)) {
    // A cycle would keep the runners alive after their last consumer unmounts.
    return;
  }

  const releaseRequest = retainDashboardSource(panel, provider);
  if (consumer instanceof SceneQueryRunner && source) {
    const sources = consumers.get(consumer);
    if (sources && !sources.has(source)) {
      sources.set(source, retainDashboardSource(panel, panel.state.$data ?? provider));
    }
  }
  return releaseRequest;
}
