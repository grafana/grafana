import { type CustomTransformOperator, type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type SystemTransformationPosition } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

// Wording shared by both transformation editors: the same transformation must not be named one
// thing in one editor and something else in the other.

/**
 * Display name for a transformation the panel's plugin contributes. A custom operator carries no id,
 * so it can only be named generically.
 */
export function getSystemTransformationName(transformation: DataTransformerConfig | CustomTransformOperator): string {
  if (typeof transformation === 'function') {
    return t(
      'dashboard-scene.system-transformations.custom-transformation-name',
      'Custom transformation (code defined)'
    );
  }

  return standardTransformersRegistry.getIfExists(transformation.id)?.name ?? transformation.id;
}

export function getSystemTransformationTooltip(): string {
  return t('dashboard-scene.system-transformations.tooltip-system', 'Added automatically by the panel. Read-only.');
}

/**
 * Names a group of these rows for assistive tech. Both editors place the groups above and below the
 * editable rows, and that placement is the only thing telling a sighted user when they run.
 */
export function getSystemTransformationsGroupLabel(position: SystemTransformationPosition): string {
  return position === 'prepend'
    ? t(
        'dashboard-scene.system-transformations.group-label-prepend',
        'Panel transformations, applied before your transformations'
      )
    : t(
        'dashboard-scene.system-transformations.group-label-append',
        'Panel transformations, applied after your transformations'
      );
}

export function SystemTransformationBadge() {
  return (
    <Badge
      text={t('dashboard-scene.system-transformations.badge-system', 'System')}
      color="blue"
      tooltip={getSystemTransformationTooltip()}
    />
  );
}
