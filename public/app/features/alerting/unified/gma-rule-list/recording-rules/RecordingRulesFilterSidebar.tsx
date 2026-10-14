import { type DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Input, Stack } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';

import { type Criteria } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import {
  FilterSidebarContainer,
  InvalidTokenNote,
  LabelMatchersEditor,
  PendingFilterNote,
  RuleTitleField,
  SidebarField,
  SidebarSection,
  SwitchField,
} from '../rule-search/filterSidebarPrimitives';

export interface RecordingRulesFilterSidebarProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: CriteriaIssue[];
}

/** Persistent filter sidebar for the Recording rules page — same mechanics as the Alert
 * sidebar, with recorded-metric/target-data-source in place of the Alert-only routing and
 * paused controls (Recording-rule paused isn't exposed, per the New filter scope). */
export function RecordingRulesFilterSidebar({
  criteria,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: RecordingRulesFilterSidebarProps) {
  const unresolvedNamespace = issues.some((issue) => issue.key === 'namespace' && issue.reason === 'unresolved');
  const unresolvedDataSource = issues.some((issue) => issue.key === 'datasource' && issue.reason === 'unresolved');

  return (
    <FilterSidebarContainer>
      <Stack direction="column" gap={0}>
        <Stack direction="row" justifyContent="flex-end">
          <Button size="sm" variant="primary" fill="text" onClick={onClear} disabled={!hasActiveFilters}>
            <Trans i18nKey="alerting.gma-rule-list.search.clear-filters">Clear filters</Trans>
          </Button>
        </Stack>
        <Stack direction="column" gap={2}>
          <SidebarSection>
            <RuleTitleField criteria={criteria} onChange={onChange} />
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.labels">Labels</Trans>}>
              <LabelMatchersEditor labels={criteria.labels} onChange={(labels) => onChange({ ...criteria, labels })} />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.folder">Folder</Trans>}
              note={unresolvedNamespace && <InvalidTokenNote />}
            >
              <NestedFolderPicker
                value={criteria.namespaces[0]}
                invalid={unresolvedNamespace}
                permission="view"
                clearable
                onChange={(uid) => onChange({ ...criteria, namespaces: uid ? [uid] : [] })}
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.datasource">Query data source</Trans>}
              note={unresolvedDataSource && <InvalidTokenNote />}
            >
              <DataSourcePicker
                current={criteria.dataSourceUids[0]}
                noDefault
                onClear={() => onChange({ ...criteria, dataSourceUids: [] })}
                onChange={(ds: DataSourceInstanceSettings) => onChange({ ...criteria, dataSourceUids: [ds.uid] })}
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.plugins">Plugin rules</Trans>}>
              <SwitchField
                label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
                value={criteria.hidePluginRules}
                onChange={(hidePluginRules) => onChange({ ...criteria, hidePluginRules })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.metric">Recorded metric</Trans>}
            >
              <Input
                placeholder={t('alerting.gma-rule-list.search.metric-placeholder', 'Metric name (exact match)')}
                value={criteria.metric ?? ''}
                onChange={(e) => onChange({ ...criteria, metric: e.currentTarget.value || undefined })}
              />
            </SidebarField>
            <SidebarField
              label={
                <Trans i18nKey="alerting.gma-rule-list.search.property.target-datasource">Target data source</Trans>
              }
            >
              <DataSourcePicker
                current={criteria.targetDataSourceUid}
                noDefault
                onClear={() => onChange({ ...criteria, targetDataSourceUid: undefined })}
                onChange={(ds: DataSourceInstanceSettings) => onChange({ ...criteria, targetDataSourceUid: ds.uid })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.health">Health</Trans>}
              note={<PendingFilterNote />}
            >
              <Input
                disabled
                placeholder={t('alerting.gma-rule-list.search.property.health-placeholder', 'Not available yet')}
              />
            </SidebarField>
          </SidebarSection>
        </Stack>
      </Stack>
    </FilterSidebarContainer>
  );
}
