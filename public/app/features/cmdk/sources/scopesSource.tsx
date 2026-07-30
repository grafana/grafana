import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Observable } from 'rxjs';

import { fuzzySearch, type GrafanaTheme2, type ScopeNode } from '@grafana/data';
import { useObservable } from '@grafana/data/unstable';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';
import { ScopesRow } from 'app/features/commandPalette/scopes/ScopesRow';
import { useScopesServices } from 'app/features/scopes/ScopesContextProvider';
import { type ScopesSelectorServiceState } from 'app/features/scopes/selector/ScopesSelectorService';
import { type NodesMap, type SelectedScope, type TreeNode } from 'app/features/scopes/selector/types';
import { useRecentScopes } from 'app/features/scopes/selector/useRecentScopes';

import { registerCmdkSource } from '../registry';
import { matchesShortcut } from '../shortcuts';
import { type CmdkItem, type CmdkItemAction, type CmdkSection, type CmdkSource } from '../types';
import { closeCmdk } from '../visibility';

const GLOBAL_SEARCH_LIMIT = 10;

// Priorities from the old palette: recent scopes way above everything, scopes above recent dashboards.
export const RECENT_SCOPES_PRIORITY = 50;
export const SCOPES_PRIORITY = 8;

// Section ids match the old palette's sectionId slugs so analytics stay comparable.
export const SECTION_SCOPES = 'scopes';
export const SECTION_RECENT_SCOPES = 'recent-scopes';

/**
 * The narrow view of ScopesSelectorService the source needs. Keeps the coupling explicit and makes the source
 * easy to construct in tests.
 */
export interface ScopesSelectorLike {
  state: ScopesSelectorServiceState;
  stateObservable: Observable<ScopesSelectorServiceState>;
  filterNode(scopeNodeId: string, query: string): Promise<unknown>;
  selectScope(scopeNodeId: string): Promise<unknown>;
  deselectScope(scopeIdOrScopeNodeId: string): Promise<unknown>;
  resetSelection(): void;
  apply(): void;
  changeScopes(scopeNames: string[], parentNodeId?: string, scopeNodeId?: string): void;
  searchAllNodes(query: string, limit: number): Promise<ScopeNode[]>;
  getScopeNodes(scopeNodeNames: string[]): Promise<ScopeNode[]>;
}

interface RecentScopesEntry {
  item: CmdkItem;
  searchText: string;
}

function scopesSection(): CmdkSection {
  return { id: SECTION_SCOPES, title: t('command-palette.action.scopes', 'Scopes') };
}

function recentScopesSection(): CmdkSection {
  return { id: SECTION_RECENT_SCOPES, title: t('command-palette.section.recent-scopes', 'Recent scopes') };
}

function findTreeNode(tree: TreeNode, scopeNodeId: string): TreeNode | undefined {
  if (tree.scopeNodeId === scopeNodeId) {
    return tree;
  }
  for (const child of Object.values(tree.children ?? {})) {
    const found = findTreeNode(child, scopeNodeId);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function isScopeSelected(selectedScopes: SelectedScope[], node: ScopeNode): boolean {
  return selectedScopes.some((selected) =>
    selected.scopeNodeId ? selected.scopeNodeId === node.metadata.name : selected.scopeId === node.spec.linkId
  );
}

function parentTitle(nodes: NodesMap, node: ScopeNode): string | undefined {
  return node.spec.parentName ? nodes[node.spec.parentName]?.spec.title : undefined;
}

// Selecting a scope is a multi-select operation: the palette stays open and re-queries so the item disappears
// from the list (it shows in the header row instead) and the apply button can appear.
function scopeSelectItem(selector: ScopesSelectorLike, node: ScopeNode, subtitle?: string): CmdkItemAction {
  return {
    type: 'action',
    id: `scopes/${node.metadata.name}`,
    sectionId: SECTION_SCOPES,
    title: node.spec.title,
    priority: SCOPES_PRIORITY,
    subtitle,
    keepOpen: true,
    action: () => {
      selector.selectScope(node.metadata.name);
    },
  };
}

/**
 * One level of the scopes tree. Container nodes push another level onto the subscope stack, leaf nodes select
 * the scope. The scope service does the filtering (frontend or backend is up to it) through filterNode.
 */
export function createScopeTreeSource(selector: ScopesSelectorLike, scopeNode?: ScopeNode): CmdkSource {
  const scopeNodeId = scopeNode?.metadata.name ?? '';
  return {
    subscopeName: scopeNode?.spec.title ?? t('command-palette.action.scopes', 'Scopes'),
    providedSections: [scopesSection()],

    async query(query): Promise<CmdkItem[]> {
      await selector.filterNode(scopeNodeId, query);

      const { tree, nodes, selectedScopes } = selector.state;
      const treeNode = tree && findTreeNode(tree, scopeNodeId);
      const items: CmdkItem[] = [];

      for (const key of Object.keys(treeNode?.children ?? {})) {
        const child = nodes[key];
        if (!child) {
          continue;
        }
        if (child.spec.nodeType === 'leaf') {
          // Selected scopes are not shown in the list, they show in the header row instead.
          if (isScopeSelected(selectedScopes, child)) {
            continue;
          }
          items.push(scopeSelectItem(selector, child, parentTitle(nodes, child)));
        } else {
          items.push({
            type: 'subscope',
            id: `scopes/${child.metadata.name}`,
            sectionId: SECTION_SCOPES,
            title: child.spec.title,
            priority: SCOPES_PRIORITY,
            subtitle: parentTitle(nodes, child),
            getScope: () => createScopeTreeSource(selector, child),
          });
        }
      }
      return items;
    },
  };
}

// Flat search across all tree levels, only showing leaf nodes (navigating to a category without knowing where
// in the tree it is has issues, same as the old palette).
async function globalScopeSearch(selector: ScopesSelectorLike, query: string): Promise<CmdkItem[]> {
  const nodes = await selector.searchAllNodes(query, GLOBAL_SEARCH_LIMIT);
  const leafNodes = nodes.filter((node) => node.spec.nodeType === 'leaf');

  const uniqueParentNames = [...new Set(leafNodes.map((node) => node.spec.parentName))].filter(
    (name): name is string => name !== undefined
  );
  const parentNodes = await selector.getScopeNodes(uniqueParentNames);
  const parentTitles = new Map(parentNodes.map((parent) => [parent.metadata.name, parent.spec.title]));

  return leafNodes.map((node) => {
    const subtitle = node.spec.parentName
      ? (parentTitles.get(node.spec.parentName) ?? node.spec.parentName)
      : undefined;
    return scopeSelectItem(selector, node, subtitle);
  });
}

/**
 * The root scopes source: recent scope sets, the entry point into the scopes tree and (when enabled) a global
 * search across all tree levels.
 */
export function createScopesRootSource(
  selector: ScopesSelectorLike,
  getRecentScopesEntries: () => RecentScopesEntry[]
): CmdkSource {
  return {
    providedSections: [recentScopesSection(), scopesSection()],
    renderHeader: ({ refresh }) => <ScopesHeader selector={selector} refresh={refresh} />,

    async query(query): Promise<CmdkItem[]> {
      const items: CmdkItem[] = [];

      const recentEntries = getRecentScopesEntries();
      if (query === '') {
        items.push(...recentEntries.map((entry) => entry.item));
      } else {
        const matches = fuzzySearch(
          recentEntries.map((entry) => entry.searchText),
          query
        );
        items.push(...matches.map((index) => recentEntries[index].item));
      }

      const scopesTitle = t('command-palette.action.scopes', 'Scopes');
      if (query === '' || fuzzySearch([`${scopesTitle} scopes filters`], query).length > 0) {
        items.push({
          type: 'subscope',
          id: 'scopes',
          sectionId: SECTION_SCOPES,
          title: scopesTitle,
          priority: SCOPES_PRIORITY,
          getScope: () => createScopeTreeSource(selector),
        });
      }

      if (query !== '' && config.featureToggles.scopeSearchAllLevels) {
        items.push(...(await globalScopeSearch(selector, query)));
      }

      return items;
    },
  };
}

/**
 * Selected scopes row under the palette input: shows the selection with deselect pills and an apply button when
 * the selection differs from what is applied. Also owns the selection lifecycle: any un-applied selection is
 * reset when the palette opens and closes (this component mounts and unmounts with the palette).
 */
function ScopesHeader({ selector, refresh }: { selector: ScopesSelectorLike; refresh: () => void }) {
  const styles = useStyles2(getStyles);
  const state = useObservable(selector.stateObservable, selector.state);

  useEffect(() => {
    selector.resetSelection();
    return () => {
      selector.resetSelection();
    };
  }, [selector]);

  const { selectedScopes, appliedScopes, nodes, scopes } = state ?? selector.state;

  const isDirty =
    appliedScopes
      .map((applied) => applied.scopeId)
      .sort()
      .join('') !==
    selectedScopes
      .map((selected) => selected.scopeId)
      .sort()
      .join('');

  const apply = useCallback(() => {
    selector.apply();
    closeCmdk();
  }, [selector]);

  useEffect(() => {
    if (!isDirty) {
      return;
    }
    const handler = (event: KeyboardEvent) => {
      if (matchesShortcut(event, 'mod+enter')) {
        event.preventDefault();
        apply();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirty, apply]);

  if (!isDirty && selectedScopes.length === 0) {
    return null;
  }

  return (
    <div className={styles.row}>
      <ScopesRow
        nodes={nodes}
        scopes={scopes}
        selectedScopes={selectedScopes}
        isDirty={isDirty}
        apply={apply}
        deselectScope={async (id) => {
          await selector.deselectScope(id);
          refresh();
        }}
      />
    </div>
  );
}

const EMPTY_STATE_OBSERVABLE: Observable<ScopesSelectorServiceState> = new Observable();

function useRecentScopesEntries(selector: ScopesSelectorLike | undefined): RecentScopesEntry[] {
  const state = useObservable(selector?.stateObservable ?? EMPTY_STATE_OBSERVABLE, selector?.state);
  const appliedScopeIds = (state ?? selector?.state)?.appliedScopes.map((applied) => applied.scopeId) ?? [];
  const recentScopes = useRecentScopes(appliedScopeIds);

  return useMemo(() => {
    if (!selector) {
      return [];
    }
    return recentScopes.map((recentScopeSet) => {
      const names = recentScopeSet.scopes.map((scope) => scope.title).join(', ');
      return {
        item: {
          type: 'action',
          id: `recent-scopes/${recentScopeSet.scopeIds.join(',')}`,
          sectionId: SECTION_RECENT_SCOPES,
          title: names,
          subtitle: recentScopeSet.parentNodeTitle,
          priority: RECENT_SCOPES_PRIORITY,
          action: () => {
            selector.changeScopes(recentScopeSet.scopeIds, undefined, recentScopeSet.scopeNodeId);
          },
        },
        searchText: recentScopeSet.scopes
          .map((scope) => `${scope.title} ${scope.id}`)
          .concat(names)
          .join(' '),
      };
    });
  }, [recentScopes, selector]);
}

export function useRegisterScopesSource() {
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;
  const entries = useRecentScopesEntries(selector);

  // The source reads the recent entries through a ref so it does not have to re-register (and re-query) every
  // time the scope service state changes — querying itself mutates that state, which would loop.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const enabled = Boolean(config.featureToggles.scopeFilters && selector);

  useEffect(() => {
    if (!enabled || !selector) {
      return;
    }
    return registerCmdkSource(createScopesRootSource(selector, () => entriesRef.current));
  }, [enabled, selector]);
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    row: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: theme.components.input.background,
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      padding: theme.spacing(1, 2),
    }),
  };
};
