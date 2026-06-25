import { isEmpty } from 'lodash';

import { Stack } from '@grafana/ui';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { DataSourceSection } from './components/DataSourceSection';
import { NoRulesFound } from './components/NoRulesFound';
import { K8sSearchFolderCard } from './gma-design/K8sSearchFolderCard';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { type K8sRuleFilter } from './hooks/useK8sFolderRules';
import { useK8sFoldersWithRules } from './hooks/useK8sFoldersWithRules';

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
  const { rootFolders, isLoading, error } = useK8sFoldersWithRules(namespaceFilter);

  const hasFilters = Boolean(groupFilter || namespaceFilter);
  const hasNoFolders = !isLoading && isEmpty(rootFolders);

  useDataSourceLoadingReporter(
    GRAFANA_RULES_SOURCE_NAME,
    { isLoading, rulesCount: rootFolders.length, error },
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
          {rootFolders.map((folder) => (
            <K8sSearchFolderCard
              key={`${folder.uid}-${ruleFilter?.ruleType ?? ''}`}
              folderUid={folder.uid}
              folderTitle={folder.title}
              groupFilter={groupFilter}
              ruleFilter={ruleFilter}
              childFolders={folder.children}
              ruleCount={folder.directRuleCount}
            />
          ))}
        </div>

        {hasNoFolders && !hasFilters && <GrafanaNoRulesCTA />}
        {hasNoFolders && hasFilters && <NoRulesFound />}
      </Stack>
    </DataSourceSection>
  );
}
