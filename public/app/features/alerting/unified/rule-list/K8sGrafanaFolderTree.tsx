import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';

import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { DataSourceSection, STICKY_SECTION_HEADER_HEIGHT } from './components/DataSourceSection';
import { NoRulesFound } from './components/NoRulesFound';
import { FolderTreeRow } from './gma-design/folderTreeRows';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { type FolderTreeModel, useFolderTreeModel } from './hooks/useFolderTreeModel';
import { type K8sRuleFilter } from './hooks/useK8sFolderRules';
import { useK8sFolderSearchList } from './hooks/useK8sFolderSearchList';

const ROW_ESTIMATE_HEIGHT = 40;

interface K8sGrafanaFolderTreeProps {
  groupFilter?: string;
  namespaceFilter?: string;
  ruleFilter?: K8sRuleFilter;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

/**
 * Grafana-managed rules grouped by folder, driven by the k8s folders API: a nested tree of all
 * folders (lazy children + counts), each expandable to its own rules via the alerting `/search`
 * endpoint. When a folder filter is active, the tree is replaced by a flat list of matching folders.
 */
export function K8sGrafanaFolderTree({
  groupFilter,
  namespaceFilter,
  ruleFilter,
  onLoadingStateChange,
}: K8sGrafanaFolderTreeProps) {
  const isSearching = Boolean(namespaceFilter?.trim());
  const search = useK8sFolderSearchList(namespaceFilter ?? '', isSearching);
  const rootFolders = isSearching ? search.folders : undefined;

  const model = useFolderTreeModel({ groupFilter, ruleFilter, rootFolders });

  const isLoading = isSearching ? search.isLoading : model.isLoadingRoot;
  const error = isSearching ? search.error : model.rootError;
  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const hasNoFolders = !isLoading && model.isEmpty;

  useDataSourceLoadingReporter(
    GRAFANA_RULES_SOURCE_NAME,
    { isLoading, rulesCount: model.rows.length, error },
    onLoadingStateChange
  );

  // Preserve old grouped-view behavior: hide the Grafana section entirely when filters
  // are active and nothing matches.
  if (hasFilters && hasNoFolders) {
    return null;
  }

  return (
    <DataSourceSection
      name="Grafana-managed"
      application="grafana"
      uid={GrafanaRulesSourceSymbol}
      isLoading={isLoading}
      error={error}
      stickyHeader
    >
      {!hasNoFolders && <VirtualizedTreeRows model={model} />}
      {hasNoFolders && !hasFilters && <GrafanaNoRulesCTA />}
      {hasNoFolders && hasFilters && <NoRulesFound />}
    </DataSourceSection>
  );
}

/**
 * Renders the flat `TreeRow[]` model with window-level virtualization so only the rows near the
 * viewport stay mounted. Every row renders uniformly (no per-row sticky, which leaves gaps under
 * virtualization); the nearest enclosing ancestor folder is pinned via a separate zero-height
 * overlay that never participates in the virtual flow.
 */
const OVERSCAN = 8;

function VirtualizedTreeRows({ model }: { model: FolderTreeModel }) {
  const rows = model.rows;

  const parentRef = useRef<HTMLDivElement>(null);
  // The list's offset from the document top. Must be document-relative (not `offsetTop`, which is
  // relative to the nearest positioned ancestor) since the window virtualizer measures against window
  // scroll. Kept in state (not a ref) so the virtualizer re-renders with the correct value.
  const [scrollMargin, setScrollMargin] = useState(0);
  useLayoutEffect(() => {
    const update = () => {
      const element = parentRef.current;
      if (element) {
        setScrollMargin(element.getBoundingClientRect().top + window.scrollY);
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // For each row, the index of its nearest *ancestor* folder (a folder at a shallower depth) — the
  // header to pin while scrolling that row's subtree. Pinning the nearest folder regardless of depth
  // would pin sibling folders rather than the parent.
  const ancestorFolderIndexByRow = useMemo(() => {
    const result: Array<number | undefined> = new Array(rows.length);
    const folderStack: number[] = [];
    for (let i = 0; i < rows.length; i++) {
      const { level } = rows[i];
      while (folderStack.length > 0 && rows[folderStack[folderStack.length - 1]].level >= level) {
        folderStack.pop();
      }
      result[i] = folderStack.length > 0 ? folderStack[folderStack.length - 1] : undefined;
      if (rows[i].kind === 'folder') {
        folderStack.push(i);
      }
    }
    return result;
  }, [rows]);

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => ROW_ESTIMATE_HEIGHT,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (index) => rows[index].key,
    measureElement: (element) => element.getBoundingClientRect().height || ROW_ESTIMATE_HEIGHT,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // The pinned header is the ancestor folder of the first row crossing the pin line — but only once
  // that ancestor's own row has itself scrolled above the line, otherwise its real row is still
  // visible and pinning would duplicate it.
  const pinLine = (virtualizer.scrollOffset ?? 0) + STICKY_SECTION_HEADER_HEIGHT;
  const firstVisible = virtualItems.find((item) => item.start + item.size > pinLine);
  const ancestorIndex = firstVisible ? ancestorFolderIndexByRow[firstVisible.index] : undefined;
  const ancestorItem = ancestorIndex !== undefined ? virtualItems.find((i) => i.index === ancestorIndex) : undefined;
  // Out of the rendered range → scrolled well above the line, so pin it.
  const pinnedIndex =
    ancestorIndex !== undefined && (!ancestorItem || ancestorItem.start + ancestorItem.size <= pinLine)
      ? ancestorIndex
      : undefined;
  const pinnedRow = pinnedIndex !== undefined ? rows[pinnedIndex] : undefined;

  return (
    <div ref={parentRef} role="tree" style={{ position: 'relative' }}>
      {pinnedRow && (
        // Zero-height sticky wrapper: pins to the top without consuming layout, so the virtual rows
        // below keep their measured positions. The header content overflows downward over the list.
        <div style={{ position: 'sticky', top: STICKY_SECTION_HEADER_HEIGHT, height: 0, zIndex: 2 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
            <FolderTreeRow
              row={pinnedRow}
              onToggle={model.toggleFolder}
              onToggleGroup={model.toggleGroup}
              onLoadMore={model.loadMoreRules}
              onLoadMoreChildren={model.loadMoreChildren}
            />
          </div>
        </div>
      )}
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualItems.map((virtualRow) => (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            <FolderTreeRow
              row={rows[virtualRow.index]}
              onToggle={model.toggleFolder}
              onToggleGroup={model.toggleGroup}
              onLoadMore={model.loadMoreRules}
              onLoadMoreChildren={model.loadMoreChildren}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
