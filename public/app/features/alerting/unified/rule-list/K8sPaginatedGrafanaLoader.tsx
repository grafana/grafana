import { isEmpty } from 'lodash';

import { Stack } from '@grafana/ui';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { DataSourceSection } from './components/DataSourceSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { K8sSearchFolderCard } from './gma-design/K8sSearchFolderCard';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { useK8sFolderCountsFilter } from './hooks/useK8sFolderCountsFilter';
import { type K8sRuleFilter } from './hooks/useK8sFolderRules';
import { useK8sFoldersPage } from './hooks/useK8sFoldersPage';

interface LoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
  ruleFilter?: K8sRuleFilter;
  onLoadingStateChange?: (uid: string, state: DataSourceLoadState) => void;
}

export function K8sPaginatedGrafanaLoader({
  groupFilter,
  namespaceFilter,
  ruleFilter,
  onLoadingStateChange,
}: LoaderProps) {
  const {
    folders,
    isLoading: isLoadingFolders,
    hasMoreFolders,
    fetchMoreFolders,
    error: foldersError,
  } = useK8sFoldersPage();
  const { filteredFolders, isLoadingCounts, error: countsError } = useK8sFolderCountsFilter(folders, namespaceFilter);

  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const isLoading = isLoadingFolders || isLoadingCounts;
  const error = foldersError ?? countsError;
  const hasNoFolders = !isLoading && isEmpty(filteredFolders);

  useDataSourceLoadingReporter(
    GRAFANA_RULES_SOURCE_NAME,
    { isLoading, rulesCount: filteredFolders.length, error },
    onLoadingStateChange
  );

  // Preserve old grouped-view behavior: hide the Grafana section entirely when filters
  // are active and no folder currently matches.
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
      <Stack direction="column" gap={0}>
        <div>
          {filteredFolders.map((folder) => {
            const folderUid = folder.metadata.name;
            if (!folderUid) {
              return null;
            }
            return (
              <K8sSearchFolderCard
                key={`${folderUid}-${ruleFilter?.ruleType ?? ''}`}
                folderUid={folderUid}
                folderTitle={getFolderTitle(folder)}
                groupFilter={groupFilter}
                ruleFilter={ruleFilter}
              />
            );
          })}
        </div>

        {hasNoFolders && !hasFilters && <GrafanaNoRulesCTA />}
        {hasNoFolders && hasFilters && <NoRulesFound />}

        {hasMoreFolders && (
          <div>
            <LoadMoreButton loading={isLoadingFolders} onClick={fetchMoreFolders} />
          </div>
        )}
      </Stack>
    </DataSourceSection>
  );
}

function getFolderTitle(folder: Folder): string {
  return folder.spec?.title ?? folder.metadata.name ?? '';
}
