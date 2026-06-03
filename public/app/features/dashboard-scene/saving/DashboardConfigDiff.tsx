import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Stack, Text, useStyles2 } from '@grafana/ui';

import { type ChangeType, type FieldChange } from './dashboardDiffModel';

interface Props {
  variableChanges: FieldChange[];
  optionChanges: FieldChange[];
}

/**
 * Static before/after rendering of the non-panel parts of a dashboard diff (variables and
 * dashboard-level options). These don't need a query runner, so they're rendered as plain values
 * rather than as part of a scene.
 */
export function DashboardConfigDiff({ variableChanges, optionChanges }: Props) {
  return (
    <Stack direction="column" gap={2}>
      <ConfigSection
        title={t('dashboard-scene.dashboard-config-diff.variables-heading', 'Variables')}
        emptyText={t('dashboard-scene.dashboard-config-diff.no-variable-changes', 'No variable changes')}
        changes={variableChanges}
      />
      <ConfigSection
        title={t('dashboard-scene.dashboard-config-diff.options-heading', 'Dashboard options')}
        emptyText={t('dashboard-scene.dashboard-config-diff.no-option-changes', 'No option changes')}
        changes={optionChanges}
      />
    </Stack>
  );
}

interface ConfigSectionProps {
  title: string;
  emptyText: string;
  changes: FieldChange[];
}

function ConfigSection({ title, emptyText, changes }: ConfigSectionProps) {
  const styles = useStyles2(getStyles);

  return (
    <section>
      <Text element="h4">{title}</Text>
      {changes.length === 0 ? (
        <Text color="secondary">{emptyText}</Text>
      ) : (
        <Stack direction="column" gap={1}>
          {changes.map((change) => (
            <div key={change.label}>
              <Stack direction="row" gap={1} alignItems="center">
                <Text element="h5">{change.label}</Text>
                <Text color="secondary" variant="bodySmall">
                  {getChangeLabel(change.type)}
                </Text>
              </Stack>
              <div className={styles.row}>
                <pre className={styles.value}>{change.oldText}</pre>
                <pre className={styles.value}>{change.newText}</pre>
              </div>
            </div>
          ))}
        </Stack>
      )}
    </section>
  );
}

function getChangeLabel(type: ChangeType): string {
  switch (type) {
    case 'added':
      return t('dashboard-scene.dashboard-config-diff.label-added', 'Added');
    case 'removed':
      return t('dashboard-scene.dashboard-config-diff.label-removed', 'Removed');
    case 'changed':
      return t('dashboard-scene.dashboard-config-diff.label-changed', 'Changed');
  }
}

function getStyles(theme: GrafanaTheme2) {
  return {
    row: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      marginTop: theme.spacing(0.5),
    }),
    value: css({
      flex: 1,
      minWidth: 0,
      margin: 0,
      padding: theme.spacing(1),
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.background.secondary,
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
