import { AppEvents } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getAppEvents, getDataSourceSrv } from '@grafana/runtime';
import { SceneObjectBase, type SceneComponentProps, type SceneObjectState } from '@grafana/scenes';
import { Box, Button, Checkbox, Drawer, Stack, Text } from '@grafana/ui';

import { getDashboardSceneFor } from '../utils/utils';

import { type DisqualificationReason, type MigrationCandidate } from './detect';
import { applyVariableMigration } from './transform';

export interface PromQueryVarMigrationDrawerState extends SceneObjectState {
  candidates: MigrationCandidate[];
  selectedNames: string[];
  onApplied?: () => void;
}

export class PromQueryVarMigrationDrawer extends SceneObjectBase<PromQueryVarMigrationDrawerState> {
  static Component = PromQueryVarMigrationDrawerRenderer;

  public constructor(state: Omit<PromQueryVarMigrationDrawerState, 'selectedNames'>) {
    super({
      ...state,
      selectedNames: state.candidates
        .filter((candidate) => !candidate.disqualified)
        .map((candidate) => candidate.variableName),
    });
  }

  public onToggle = (variableName: string) => {
    const { selectedNames } = this.state;
    this.setState({
      selectedNames: selectedNames.includes(variableName)
        ? selectedNames.filter((name) => name !== variableName)
        : [...selectedNames, variableName],
    });
  };

  public onClose = () => {
    getDashboardSceneFor(this).closeModal();
  };

  public onApply = () => {
    const dashboard = getDashboardSceneFor(this);
    const selected = this.state.candidates.filter(
      (candidate) => !candidate.disqualified && this.state.selectedNames.includes(candidate.variableName)
    );

    // Close before applying: applying enters edit mode, which snapshots the scene state
    // for discard — the snapshot must not contain this drawer as the open overlay.
    dashboard.closeModal();
    applyVariableMigration(dashboard, selected);
    this.state.onApplied?.();

    getAppEvents().publish({
      type: AppEvents.alertSuccess.name,
      payload: [
        t('dashboard-scene.variable-migration.applied-title', 'Variables migrated to drilldown controls'),
        t(
          'dashboard-scene.variable-migration.applied-body',
          'The change is not saved yet. Review the dashboard and save it to keep the migration, or discard the changes.'
        ),
      ],
    });
  };
}

function PromQueryVarMigrationDrawerRenderer({ model }: SceneComponentProps<PromQueryVarMigrationDrawer>) {
  const { candidates, selectedNames } = model.useState();

  const byDatasource = new Map<string, MigrationCandidate[]>();
  for (const candidate of candidates) {
    const dsKey = candidate.datasourceUid ?? '';
    byDatasource.set(dsKey, [...(byDatasource.get(dsKey) ?? []), candidate]);
  }

  return (
    <Drawer
      title={t('dashboard-scene.variable-migration.drawer-title', 'Migrate variables to drilldown controls')}
      subtitle={t(
        'dashboard-scene.variable-migration.drawer-subtitle',
        'Selected query variables are replaced by one filter control per data source. Queries keep returning the same data.'
      )}
      size="md"
      onClose={model.onClose}
    >
      <Stack direction="column" gap={3}>
        {[...byDatasource.entries()].map(([dsUid, dsCandidates]) => (
          <Stack key={dsUid} direction="column" gap={1}>
            <Text element="h4">{getDatasourceLabel(dsUid)}</Text>
            {dsCandidates.map((candidate) => (
              <Checkbox
                key={candidate.variableName}
                data-testid={`migration-candidate-${candidate.variableName}`}
                label={t('dashboard-scene.variable-migration.candidate-label', '${{name}} — {{description}}', {
                  name: candidate.variableName,
                  description: getCandidateDescription(candidate),
                  // rendered as a React string prop, so html-escaping only garbles quotes
                  interpolation: { escapeValue: false },
                })}
                description={
                  candidate.disqualified ? getReasonsText(candidate.reasons) : getUsageText(candidate.queryCount)
                }
                disabled={candidate.disqualified}
                value={selectedNames.includes(candidate.variableName)}
                onChange={() => model.onToggle(candidate.variableName)}
              />
            ))}
          </Stack>
        ))}
        <Box marginTop={2}>
          <Stack direction="row" gap={2} alignItems="center">
            <Button variant="secondary" onClick={model.onClose}>
              <Trans i18nKey="dashboard-scene.variable-migration.drawer-cancel">Cancel</Trans>
            </Button>
            <Button variant="primary" disabled={selectedNames.length === 0} onClick={model.onApply}>
              <Trans i18nKey="dashboard-scene.variable-migration.drawer-apply">Apply</Trans>
            </Button>
            <Text color="secondary" variant="bodySmall">
              <Trans i18nKey="dashboard-scene.variable-migration.drawer-apply-note">
                Changes are not saved until you save the dashboard.
              </Trans>
            </Text>
          </Stack>
        </Box>
      </Stack>
    </Drawer>
  );
}

function getDatasourceLabel(dsUid: string): string {
  if (!dsUid) {
    return t('dashboard-scene.variable-migration.unknown-datasource', 'Unknown data source');
  }
  return getDataSourceSrv().getInstanceSettings(dsUid)?.name ?? dsUid;
}

function getCandidateDescription(candidate: MigrationCandidate): string {
  switch (candidate.kind) {
    case 'filter':
      return t('dashboard-scene.variable-migration.kind-filter', 'filter on "{{labelKey}}"', {
        labelKey: candidate.filterKey,
      });
    case 'groupBy':
      return t('dashboard-scene.variable-migration.kind-group-by', 'group by');
    case 'both':
      return t('dashboard-scene.variable-migration.kind-both', 'filter on "{{labelKey}}" and group by', {
        labelKey: candidate.filterKey,
      });
    default:
      return t('dashboard-scene.variable-migration.kind-none', 'cannot migrate');
  }
}

function getUsageText(queryCount: number): string {
  return t('dashboard-scene.variable-migration.usage-count', '', {
    count: queryCount,
    defaultValue_one: 'Used in {{count}} query',
    defaultValue_other: 'Used in {{count}} queries',
  });
}

function getReasonsText(reasons: DisqualificationReason[]): string {
  return [...new Set(reasons.map(getReasonText))].join('; ');
}

function getReasonText(reason: DisqualificationReason | undefined): string {
  switch (reason?.code) {
    case 'datasource-variable-ref':
      return t(
        'dashboard-scene.variable-migration.reason-datasource-variable-ref',
        'The variable data source is itself a variable'
      );
    case 'datasource-not-found':
      return t('dashboard-scene.variable-migration.reason-datasource-not-found', 'The data source was not found');
    case 'cross-datasource-usage':
      return t(
        'dashboard-scene.variable-migration.reason-cross-datasource',
        'Used in queries of a different data source'
      );
    case 'query-parse-error':
      return t('dashboard-scene.variable-migration.reason-parse-error', 'A query using it could not be parsed');
    case 'unsupported-variable-syntax':
      return t(
        'dashboard-scene.variable-migration.reason-unsupported-syntax',
        'A query using it contains unsupported variable syntax'
      );
    case 'unsafe-position':
      return t(
        'dashboard-scene.variable-migration.reason-unsafe-position',
        'Used outside label filters and by(...) grouping: {{detail}}',
        { detail: reason.detail }
      );
    case 'ambiguous-filter-key':
      return t(
        'dashboard-scene.variable-migration.reason-ambiguous-key',
        'Used with different label keys: {{detail}}',
        { detail: reason.detail }
      );
    case 'empty-current-value':
      return t(
        'dashboard-scene.variable-migration.reason-empty-value',
        'Its current value is empty, which a filter cannot represent'
      );
    case 'not-used-in-queries':
      return t('dashboard-scene.variable-migration.reason-not-used', 'Not used in any panel query');
    case 'panel-repeat':
      return t('dashboard-scene.variable-migration.reason-repeat', 'Used for panel or row repeating');
    case 'library-panel':
      return t('dashboard-scene.variable-migration.reason-library-panel', 'Used in a library panel query');
    case 'referenced-outside-queries':
      return t(
        'dashboard-scene.variable-migration.reason-outside-queries',
        'Referenced outside panel queries ({{detail}})',
        { detail: reason.detail }
      );
    case 'save-model-serialization-failed':
      return t(
        'dashboard-scene.variable-migration.reason-serialization-failed',
        'The dashboard could not be checked for other usages'
      );
    default:
      return t('dashboard-scene.variable-migration.reason-unknown', 'Cannot be migrated');
  }
}
