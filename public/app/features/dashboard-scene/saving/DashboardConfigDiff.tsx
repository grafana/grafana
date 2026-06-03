import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { IconButton, Stack, Text, useStyles2 } from '@grafana/ui';

import { type ChangeType, type FieldChange } from './dashboardDiffModel';

interface Props {
  optionChanges: FieldChange[];
  onDismiss: (change: FieldChange) => void;
  anchorId?: (index: number) => string;
}

/**
 * Static before/after rendering of the dashboard-level options diff. These don't need a query
 * runner, so they're rendered as plain values rather than as part of a scene. Each row can be
 * dismissed to revert that change in the dashboard.
 */
export function DashboardConfigDiff({ optionChanges, onDismiss, anchorId }: Props) {
  return (
    <ConfigSection
      title={t('dashboard-scene.dashboard-config-diff.options-heading', 'Dashboard options')}
      emptyText={t('dashboard-scene.dashboard-config-diff.no-option-changes', 'No option changes')}
      changes={optionChanges}
      onDismiss={onDismiss}
      anchorId={anchorId}
    />
  );
}

interface ConfigSectionProps {
  title: string;
  emptyText: string;
  changes: FieldChange[];
  onDismiss: (change: FieldChange) => void;
  anchorId?: (index: number) => string;
}

function ConfigSection({ title, emptyText, changes, onDismiss, anchorId }: ConfigSectionProps) {
  const styles = useStyles2(getStyles);

  return (
    <section>
      <Text element="h4">{title}</Text>
      {changes.length === 0 ? (
        <Text color="secondary">{emptyText}</Text>
      ) : (
        <Stack direction="column" gap={1}>
          {changes.map((change, index) => (
            <div key={change.label} id={anchorId?.(index)} className={styles.changeBlock}>
              <Stack direction="row" gap={1} alignItems="center">
                <Text element="h5">{change.label}</Text>
                <Text color="secondary" variant="bodySmall">
                  {getChangeLabel(change.type)}
                </Text>
              </Stack>
              <div className={styles.row}>
                <pre className={cx(styles.value, change.oldText ? styles.valueOld : undefined)}>{change.oldText}</pre>
                <div className={styles.divider} />
                <pre className={cx(styles.value, change.newText ? styles.valueNew : undefined)}>{change.newText}</pre>
                <div className={styles.actions}>
                  <IconButton
                    name="history"
                    tooltip={t('dashboard-scene.dashboard-diff-view.dismiss-tooltip', 'Revert this change')}
                    onClick={() => onDismiss(change)}
                  />
                </div>
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
    changeBlock: css({
      scrollMarginTop: theme.spacing(6),
    }),
    row: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
      marginTop: theme.spacing(0.5),
    }),
    divider: css({
      flexShrink: 0,
      width: 1,
      alignSelf: 'stretch',
      background: theme.colors.border.medium,
    }),
    actions: css({
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: theme.spacing(4),
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
    valueOld: css({
      borderColor: theme.colors.error.border,
      background: theme.colors.error.transparent,
    }),
    valueNew: css({
      borderColor: theme.colors.success.border,
      background: theme.colors.success.transparent,
    }),
  };
}
