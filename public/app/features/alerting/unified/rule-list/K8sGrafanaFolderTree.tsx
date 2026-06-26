import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { DataSourceSection } from './components/DataSourceSection';
import { NoRulesFound } from './components/NoRulesFound';
import { FolderTreeRow } from './gma-design/folderTreeRows';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { useFolderTreeModel } from './hooks/useFolderTreeModel';
import { type K8sRuleFilter } from './hooks/useK8sFolderRules';
import { useK8sFolderSearchList } from './hooks/useK8sFolderSearchList';

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
    >
      <div role="tree">
        {model.rows.map((row) => (
          <FolderTreeRow key={row.key} row={row} onToggle={model.toggleFolder} onLoadMore={model.loadMoreRules} />
        ))}
        {hasNoFolders && !hasFilters && <GrafanaNoRulesCTA />}
        {hasNoFolders && hasFilters && <NoRulesFound />}
      </div>
    </DataSourceSection>
  );
}
