import { isEmpty } from 'lodash';

import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';

import { AlertingFolder } from './components/AlertingFolder';
import { DataSourceSection } from './components/DataSourceSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { useAlertingFolders } from './hooks/useAlertingFolders';

interface LoaderProps {
  groupFilter?: string;
  namespaceFilter?: string;
}

export function PaginatedGrafanaLoader({ groupFilter, namespaceFilter }: LoaderProps) {
  const key = `${groupFilter}-${namespaceFilter}`;

  // Key is crucial. It resets the state when filters change.
  return <PaginatedFoldersLoader key={key} groupFilter={groupFilter} namespaceFilter={namespaceFilter} />;
}

function PaginatedFoldersLoader({ groupFilter, namespaceFilter }: LoaderProps) {
  const hasFilters = Boolean(groupFilter || namespaceFilter);

  // TODO: Implement folder/group filtering when filters are provided
  // For now, we fetch all folders and filtering happens at the group level within each folder

  // Fetch folders containing alert rules
  const { folders, isLoading, hasMore, fetchMore, error } = useAlertingFolders();

  const hasNoFolders = isEmpty(folders) && !isLoading;

  return (
    <DataSourceSection
      name="Grafana-managed"
      application="grafana"
      uid={GrafanaRulesSourceSymbol}
      isLoading={isLoading && isEmpty(folders)}
      error={error}
    >
      {folders.map((folder) => (
        <AlertingFolder key={folder.uid} folder={folder} />
      ))}

      {/* only show the CTA if the user has no rules and this isn't the result of a filter / search query */}
      {hasNoFolders && !hasFilters && <GrafanaNoRulesCTA />}
      {hasNoFolders && hasFilters && <NoRulesFound />}

      {hasMore && (
        <div>
          <LoadMoreButton loading={isLoading} onClick={fetchMore} />
        </div>
      )}
    </DataSourceSection>
  );
}
