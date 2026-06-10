import { cx } from '@emotion/css';
import { isEmpty } from 'lodash';
import { useState } from 'react';

import { Trans } from '@grafana/i18n';
import { Stack, useStyles2 } from '@grafana/ui';
import { type Folder } from 'app/api/clients/folder/v1beta1';
import { GrafanaRulesSourceSymbol } from 'app/types/unified-alerting';

import { GrafanaNoRulesCTA } from '../components/rules/NoRulesCTA';
import { useURLSearchParams } from '../hooks/useURLSearchParams';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';

import { DataSourceSection } from './components/DataSourceSection';
import { LoadMoreButton } from './components/LoadMoreButton';
import { NoRulesFound } from './components/NoRulesFound';
import { K8sFolderCard } from './gma-design/K8sFolderCard';
import { type RuleKind } from './gma-design/K8sRuleRow';
import { K8sSearchFolderCard } from './gma-design/K8sSearchFolderCard';
import { getRuleDesignStyles } from './gma-design/styles';
import { useDataSourceLoadingReporter } from './hooks/useDataSourceLoadingReporter';
import { type DataSourceLoadState } from './hooks/useDataSourceLoadingStates';
import { useK8sFolderCountsFilter } from './hooks/useK8sFolderCountsFilter';
import { type K8sRuleFilter, parseRecordingSplitMode } from './hooks/useK8sFolderRules';
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
  const styles = useStyles2(getRuleDesignStyles);
  const [searchParams] = useURLSearchParams();
  const recordingSplitMode = parseRecordingSplitMode(searchParams.get('recordingSplitMode'));
  const [topLevelTab, setTopLevelTab] = useState<RuleKind>('alerting');

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
  const isTabbed = recordingSplitMode === 'tabbed';

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

  const singleKind: RuleKind | undefined = isTabbed ? topLevelTab : undefined;

  return (
    <DataSourceSection
      name="Grafana-managed"
      application="grafana"
      uid={GrafanaRulesSourceSymbol}
      isLoading={isLoading}
      error={error}
    >
      <Stack direction="column" gap={0}>
        {isTabbed && (
          <div className={styles.splitToggle}>
            <button
              type="button"
              className={cx(styles.splitToggleButton, topLevelTab === 'alerting' && styles.splitToggleButtonOn)}
              onClick={() => setTopLevelTab('alerting')}
            >
              <Trans i18nKey="alerting.k8s-grafana-loader.tabbed.alerting">Alerting rules</Trans>
            </button>
            <button
              type="button"
              className={cx(styles.splitToggleButton, topLevelTab === 'recording' && styles.splitToggleButtonOn)}
              onClick={() => setTopLevelTab('recording')}
            >
              <Trans i18nKey="alerting.k8s-grafana-loader.tabbed.recording">Recording rules</Trans>
            </button>
          </div>
        )}

        <div>
          {filteredFolders.map((folder) => {
            const folderUid = folder.metadata.name;
            if (!folderUid) {
              return null;
            }
            if (recordingSplitMode === 'search') {
              return (
                <K8sSearchFolderCard
                  key={`${folderUid}-search-${ruleFilter?.ruleType ?? ''}`}
                  folderUid={folderUid}
                  folderTitle={getFolderTitle(folder)}
                  groupFilter={groupFilter}
                  ruleFilter={ruleFilter}
                />
              );
            }
            return (
              <K8sFolderCard
                key={`${folderUid}-${singleKind ?? recordingSplitMode}-${ruleFilter?.ruleType ?? ''}`}
                folderUid={folderUid}
                folderTitle={getFolderTitle(folder)}
                treatment={recordingSplitMode}
                groupFilter={groupFilter}
                ruleFilter={ruleFilter}
                singleKind={singleKind}
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
