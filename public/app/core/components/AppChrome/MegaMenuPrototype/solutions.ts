// PROTOTYPE — throwaway. Draft solution mapping from .scratch/mega-menu-solutions/spec.md.
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type IconName, type NavModelItem } from '@grafana/data';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { useSelector } from 'app/types/store';

import { getActiveItem, hasChildMatch } from '../MegaMenu/utils';

import { activeSolutionStore, useStoreValue } from './state';

export interface Solution {
  id: string;
  name: string;
  icon: IconName;
  description: string;
  sections: NavModelItem[];
}

interface SolutionDef extends Omit<Solution, 'sections'> {
  sectionIds: string[];
  // Shown when the local instance has none of the solution's group sections (no Cloud apps installed).
  mocks: NavModelItem[];
  // Mocks listed above the real sections.
  leadingMocks?: NavModelItem[];
}

export const MOCK_PREFIX = 'proto-mock/';

const mock = (text: string, icon: IconName | undefined, children: string[] = []): NavModelItem => ({
  id: `${MOCK_PREFIX}${text}`,
  text,
  icon,
  children: children.map((c) => ({ id: `${MOCK_PREFIX}${text}/${c}`, text: c })),
});

const SOLUTION_DEFS: SolutionDef[] = [
  {
    id: 'observability',
    name: 'Observability',
    icon: 'heart-rate',
    description: 'Explore, drill down and monitor apps and infrastructure',
    sectionIds: ['explore', 'drilldown', 'notebooks', 'observability', 'infrastructure'],
    mocks: [
      mock('Application', 'monitor', ['Services', 'Service map', 'Settings']),
      mock('Frontend', 'gf-grid', ['Apps', 'Sessions', 'Errors']),
      mock('Kubernetes', 'cube', ['Clusters', 'Workloads', 'Nodes', 'Cost']),
      mock('Cloud provider', 'cloud', ['AWS', 'Azure', 'GCP']),
    ],
  },
  {
    id: 'alerts-irm',
    name: 'Alerts & IRM',
    icon: 'bell',
    description: 'Alert rules, incidents, on-call and SLOs',
    sectionIds: ['alerting', 'alerts-and-incidents'],
    leadingMocks: [mock('Service Center', 'layer-group', ['Overview', 'Services', 'Teams'])],
    mocks: [
      mock('IRM', 'fire', ['Incidents', 'Schedules', 'Escalation chains']),
      mock('SLO', 'chart-line', ['Manage SLOs', 'Reports']),
    ],
  },
  {
    id: 'testing',
    name: 'Testing & synthetics',
    icon: 'k6',
    description: 'Performance tests and synthetic checks',
    sectionIds: ['testing-and-synthetics'],
    mocks: [
      mock('Performance testing', 'k6', ['Projects', 'Tests', 'Results']),
      mock('Synthetics', 'compass', ['Checks', 'Probes', 'Alerts']),
    ],
  },
  {
    id: 'telemetry',
    name: 'Telemetry management',
    icon: 'sliders-v-alt',
    description: 'Adaptive telemetry and cost management',
    sectionIds: ['adaptive-telemetry', 'cost-management'],
    mocks: [
      mock('Adaptive Telemetry', 'bolt', ['Adaptive Metrics', 'Adaptive Logs', 'Adaptive Traces']),
      mock('Cost management', 'dollar-alt', ['Usage', 'Billing', 'Attribution']),
    ],
  },
];

// Backend group sections that bundle apps. A solution is the group, so the group's children become
// the solution's sections instead of one row with the whole group behind its arrow.
const GROUP_SECTION_IDS = new Set([
  'observability',
  'infrastructure',
  'alerts-and-incidents',
  'testing-and-synthetics',
  'adaptive-telemetry',
]);

// Some apps (Knowledge Graph) spread their pages straight into a group as icon-less rows. Once the
// group is flattened those read as children of the row above, so bundle them back into one section
// per app, placed where its first page was.
const APP_NAMES: Record<string, { text: string; icon: IconName }> = {
  'grafana-asserts-app': { text: 'Knowledge Graph', icon: 'asserts' },
};

const appIdFromUrl = (url?: string) => url?.match(/\/a\/([^/]+)/)?.[1];

function expandGroup(group: NavModelItem): NavModelItem[] {
  const children = group.children ?? [];
  const isLoose = (c: NavModelItem) => !c.icon && !c.img && !c.children?.length;
  const bundles = new Map<string, NavModelItem>();
  const result: NavModelItem[] = [];
  for (const child of children) {
    if (!isLoose(child)) {
      result.push(child);
      continue;
    }
    const appId = appIdFromUrl(child.url) ?? 'unknown';
    let bundle = bundles.get(appId);
    if (!bundle) {
      const known = APP_NAMES[appId];
      bundle = {
        id: `${group.id}/bundle/${appId}`,
        text: known?.text ?? `More ${group.text}`,
        icon: known?.icon ?? 'apps',
        url: child.url,
        children: [],
      };
      bundles.set(appId, bundle);
      result.push(bundle);
    }
    bundle.children!.push(child);
  }
  // A single loose page doesn't need a bundle.
  return result.flatMap((c) => (c.id?.includes('/bundle/') && c.children?.length === 1 ? c.children : [c]));
}

export const SHARED_SECTION_IDS = ['home', 'bookmarks', 'starred', 'dashboards/browse'];
export const BOTTOM_SECTION_IDS = ['connections', 'cfg'];
const NEVER_LISTED = new Set(['profile', 'help']);
export const MORE_APPS_ID = 'more-apps';
const PINNED_ICON: IconName = 'bookmark';

export interface SolutionNav {
  shared: NavModelItem[];
  solutions: Solution[];
  moreApps: NavModelItem[];
  bottom: NavModelItem[];
  profile?: NavModelItem;
  activeItem?: NavModelItem;
  activeSolution: Solution;
  /** The solution owning the current page, if the page isn't in a shared or bottom section. */
  owningSolutionId?: string;
}

const warned = new Set<string>();

export function useSolutionNav(): SolutionNav {
  const navTree = useSelector((state) => state.navBarTree);
  const { chrome } = useGrafana();
  const sectionNav = chrome.useState().sectionNav.node;
  const { pathname } = useLocation();
  const activeId = useStoreValue(activeSolutionStore);

  const grouped = useMemo(() => {
    const byId = new Map(navTree.map((s) => [s.id ?? s.text, s]));
    const claimed = new Set<string>([...SHARED_SECTION_IDS, ...BOTTOM_SECTION_IDS, ...NEVER_LISTED, 'apps']);

    const solutions: Solution[] = SOLUTION_DEFS.map(({ sectionIds, mocks, leadingMocks = [], ...def }) => {
      sectionIds.forEach((id) => claimed.add(id));
      const found = sectionIds.map((id) => byId.get(id)).filter((s): s is NavModelItem => Boolean(s));
      const hasGroupSection = found.some((s) => GROUP_SECTION_IDS.has(s.id ?? ''));
      const seen = new Set<string>();
      const real = found
        .flatMap((s) => (GROUP_SECTION_IDS.has(s.id ?? '') ? expandGroup(s) : [s]))
        .filter((s) => !s.isCreateAction)
        .filter((s) => {
          const key = s.id ?? s.url ?? s.text;
          if (seen.has(key)) {
            return false;
          }
          seen.add(key);
          return true;
        });
      // Without the Cloud app groups (plain OSS), pad with mocks so each solution feels real.
      return { ...def, sections: hasGroupSection ? real : [...leadingMocks, ...real, ...mocks] };
    });

    const unmapped = navTree.filter((s) => !claimed.has(s.id ?? s.text));
    unmapped.forEach((s) => {
      if (!warned.has(s.text)) {
        warned.add(s.text);
        console.warn(`[nav prototype] section "${s.id ?? s.text}" has no solution; listing it under More apps`);
      }
    });
    const moreApps = [...(byId.get('apps')?.children ?? []), ...unmapped];

    return {
      shared: SHARED_SECTION_IDS.map((id) => byId.get(id))
        .filter((s): s is NavModelItem => Boolean(s))
        .map((s) => (s.id === 'bookmarks' ? { ...s, text: 'Pinned', icon: PINNED_ICON } : s)),
      solutions,
      moreApps,
      bottom: BOTTOM_SECTION_IDS.map((id) => byId.get(id)).filter((s): s is NavModelItem => Boolean(s)),
      profile: byId.get('profile'),
    };
  }, [navTree]);

  const moreAppsSolution: Solution = {
    id: MORE_APPS_ID,
    name: 'More apps',
    icon: 'apps',
    description: 'Apps that have not declared a solution',
    sections: grouped.moreApps,
  };
  const allSolutions = [...grouped.solutions, ...(grouped.moreApps.length ? [moreAppsSolution] : [])];

  const searchable = [...grouped.shared, ...grouped.bottom, ...allSolutions.flatMap((s) => s.sections)];
  const activeItem = getActiveItem(searchable, sectionNav, pathname);
  const owner = activeItem
    ? allSolutions.find((sol) => sol.sections.some((s) => s === activeItem || hasChildMatch(s, activeItem)))
    : undefined;

  return {
    ...grouped,
    solutions: allSolutions,
    activeItem,
    activeSolution: allSolutions.find((s) => s.id === activeId) ?? allSolutions[0],
    owningSolutionId: owner?.id,
  };
}

/** Destinations shown in a section's popout: create actions are shortcuts, not destinations. */
export function getDestinations(section: NavModelItem): NavModelItem[] {
  return (section.children ?? []).filter((c) => !c.isCreateAction);
}

export function isActiveWithin(item: NavModelItem, activeItem?: NavModelItem) {
  return item === activeItem || hasChildMatch(item, activeItem);
}
