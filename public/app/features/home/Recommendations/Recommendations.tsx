import { useEffect, useRef, useState } from 'react';
import { useAsync } from 'react-use';

import { store } from '@grafana/data';
import { useStoredBoolean } from 'app/core/hooks/useStored';
import { contextSrv } from 'app/core/services/context_srv';
import { isOnPrem } from 'app/core/utils/isOnPrem';
import { type LocalPlugin } from 'app/features/plugins/admin/types';
import { AccessControlAction } from 'app/types/accessControl';

import { setupGuideEnabled } from '../solutions/pluginAvailability';
import { type SolutionState } from '../solutions/solutionState';
import { getTelemetrySetupLink } from '../solutions/telemetrySetup';
import { type SolutionId } from '../solutions/types';
import { type HomepageSolutions } from '../useHomepageSolutions';

import { RecommendationsSkeleton, RecommendationsView } from './RecommendationsView';
import { fetchInstalledPlugins, getRecommendationCards, type PluginRecommendationCard } from './pluginRecommendations';
import { orderCardsForSolution, type RecommendedCardId, selectRecommendations } from './solutionsMatrix';
import { type RecommendationItem } from './types';

const HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.collapsed';
const HOME_RECOMMENDATIONS_EMPTY_LOCAL_STORAGE_KEY = 'grafana.home.recommendations.empty';

interface RecommendationsProps {
  solutions: HomepageSolutions;
}

export function Recommendations({ solutions }: RecommendationsProps) {
  if (isOnPrem()) {
    return null;
  }
  // Unscoped pre-gate; each card re-checks its scoped permission. Plugin management or
  // datasource creation qualifies — everyone else is spared the recommendation work.
  const canWriteSome = contextSrv.hasPermission(AccessControlAction.PluginsWrite);
  const canCreateDataSources = contextSrv.hasPermission(AccessControlAction.DataSourcesCreate);
  if (!canWriteSome && !canCreateDataSources) {
    return null;
  }
  return <GatedRecommendations solutions={solutions} />;
}

interface GatedRecommendationsProps {
  solutions: HomepageSolutions;
}

function toEnableItem(recommendation: PluginRecommendationCard): RecommendationItem {
  return { ...recommendation, cta: 'enable' };
}

// Enabled but silent: send the user into the app to finish setup, not back to the catalog.
function toSetupItem(recommendation: PluginRecommendationCard): RecommendationItem {
  return { ...recommendation, action: recommendation.setupAction, href: recommendation.appHref, cta: 'setup' };
}

function selectRecommendationState(inventory: LocalPlugin[], signals: SolutionState, setupGuideEnabled: boolean) {
  const pluginsById = new Map(inventory.map((plugin) => [plugin.id, plugin]));
  const selection = selectRecommendations(signals);
  const cardsById = getRecommendationCards();

  // An unavailable plugin list fails closed (plugin cards only). /api/plugins always lists at
  // least the core plugins, so an empty response means the list is unreliable and also fails closed.
  const listReady = inventory.length > 0;

  const toItems = (cards: RecommendedCardId[]): RecommendationItem[] =>
    cards.flatMap((cardId): RecommendationItem[] => {
      const card = cardsById[cardId];
      if (card.kind === 'connection') {
        // Independent of the plugin list: a failing /api/plugins must not hide a connection card.
        if (!contextSrv.hasPermission(AccessControlAction.DataSourcesCreate)) {
          return [];
        }
        if (card.telemetryType) {
          return [{ ...card, ...getTelemetrySetupLink(card.telemetryType, { setupGuideEnabled }) }];
        }
        return [card];
      }
      if (!listReady) {
        return [];
      }
      const plugin = pluginsById.get(card.pluginId);
      if (!plugin) {
        return [];
      }
      if (plugin.enabled) {
        // Telemetry onboarding can happen without drilldown access. Other app-specific setup
        // flows still require access to the app page they open.
        if (card.telemetryType) {
          return [
            {
              ...toSetupItem(card),
              ...getTelemetrySetupLink(card.telemetryType, { setupGuideEnabled }),
            },
          ];
        }
        // App access gates the destination page; setupPermission gates the flow itself.
        const canSetup =
          contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsAppAccess, plugin) &&
          (!card.setupPermission || contextSrv.hasPermission(card.setupPermission));
        return canSetup ? [toSetupItem(card)] : [];
      }
      // plugins:write is scoped to this plugin.
      return contextSrv.hasPermissionInMetadata(AccessControlAction.PluginsWrite, plugin) ? [toEnableItem(card)] : [];
    });

  const recommendations = toItems(selection.cards);
  // Per-solution views are permutations of the same selection (membership is the matrix's
  // call, never the view's), so the skeleton and region-hide gates below stay list-agnostic.
  // The Record type keeps the literal in lockstep with SOLUTION_IDS.
  const forSolution = (id: SolutionId) => toItems(orderCardsForSolution(selection.cards, id));
  const recommendationsBySolution: Record<SolutionId, RecommendationItem[]> = {
    kubernetes: forSolution('kubernetes'),
    metrics: forSolution('metrics'),
    logs: forSolution('logs'),
    traces: forSolution('traces'),
    synthetics: forSolution('synthetics'),
  };

  // Unknown signals and an unreliable plugin list are transient, so an empty verdict built on them says nothing.
  // Every signal counts: a gated probe (span metrics, synthetics, IRM) hides its card without marking the row unknown.
  const conclusive = listReady && Object.values(signals).every((status) => status !== 'unknown');
  return { selection, recommendations, recommendationsBySolution, conclusive };
}

function GatedRecommendations({ solutions }: GatedRecommendationsProps) {
  const [collapsed, setCollapsed] = useStoredBoolean(HOME_RECOMMENDATIONS_COLLAPSED_LOCAL_STORAGE_KEY, false);
  // A stored collapsed preference must not start recommendation selection. Monotonic
  // render-time latch: expanding never commits an ungated frame, re-collapsing never reselects.
  const everExpanded = useRef(!collapsed);
  if (!collapsed) {
    everExpanded.current = true;
  }
  const selectionEnabled = everExpanded.current;

  // Keyed on the signal snapshot, not the solution set: the set changes when the Kubernetes filter
  // changes, but the signals do not, and re-selecting would re-report the shown recommendations.
  const { signals } = solutions;
  const selected = useAsync(async () => {
    if (!selectionEnabled) {
      return undefined;
    }
    const [inventory, state, guideEnabled] = await Promise.all([
      fetchInstalledPlugins().catch(() => []),
      signals(),
      setupGuideEnabled(),
    ]);
    return selectRecommendationState(inventory, state, guideEnabled);
  }, [selectionEnabled, signals]);

  // While the selection runs, the region holds its space unless this browser's last conclusive verdict was empty:
  // a stack with nothing left to recommend rarely changes, and reserving space only to collapse it moves the page.
  // A verdict that flips to non-empty mounts the region late, once (also after an org switch: the hint is per
  // browser). Read once per mount, so another tab's verdict cannot swap this visit's reservation mid-load.
  const [knownEmpty] = useState(() => store.getBool(HOME_RECOMMENDATIONS_EMPTY_LOCAL_STORAGE_KEY, false));
  const state = selected.value;
  useEffect(() => {
    if (state?.conclusive) {
      store.set(HOME_RECOMMENDATIONS_EMPTY_LOCAL_STORAGE_KEY, state.recommendations.length === 0);
    }
  }, [state]);
  if (selectionEnabled) {
    if (!state) {
      return knownEmpty ? null : <RecommendationsSkeleton />;
    }
    // All-or-nothing: the region never renders one column alone, so an empty right column (inconclusive detection,
    // nothing left to recommend, every card failing closed) hides it. The collapsed render keeps its header row:
    // without selection, emptiness is unknowable.
    if (state.recommendations.length === 0) {
      return null;
    }
  }

  return (
    <RecommendationsView
      recommendations={state?.recommendations ?? []}
      recommendationsBySolution={state?.recommendationsBySolution ?? EMPTY_BY_SOLUTION}
      startingState={state?.selection.baseRow ?? 'unknown'}
      collapsed={collapsed}
      setCollapsed={setCollapsed}
      solutions={solutions.solutions}
    />
  );
}

const EMPTY_BY_SOLUTION: Record<SolutionId, RecommendationItem[]> = {
  kubernetes: [],
  metrics: [],
  logs: [],
  traces: [],
  synthetics: [],
};
