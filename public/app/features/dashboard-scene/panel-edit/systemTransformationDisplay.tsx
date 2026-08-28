import { type ReactNode } from 'react';

import { type CustomTransformOperator, type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SystemTransformationPosition } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

// Wording and markup shared by both transformation editors

/**
 * Display name for system transformation.
 */
function getSystemTransformationName(transformation: DataTransformerConfig | CustomTransformOperator): string {
  if (typeof transformation === 'function') {
    return t(
      'dashboard-scene.system-transformations.custom-transformation-name',
      'Custom transformation (code defined)'
    );
  }

  return standardTransformersRegistry.getIfExists(transformation.id)?.name ?? transformation.id;
}

/**
 * System transformation tooltip.
 */
export function getSystemTransformationTooltip(): string {
  return t('dashboard-scene.system-transformations.tooltip-system', 'Added automatically by the panel. Read-only.');
}

/**
 * System transformation row label
 */
function getSystemTransformationsGroupLabel(position: SystemTransformationPosition): string {
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

/**
 * System transformation badge (classic UI only)
 */
export function SystemTransformationBadge() {
  return (
    <Badge
      text={t('dashboard-scene.system-transformations.badge-system', 'System')}
      color="blue"
      tooltip={getSystemTransformationTooltip()}
    />
  );
}

interface SystemTransformationListProps {
  transformations: Array<DataTransformerConfig | CustomTransformOperator>;
  position: SystemTransformationPosition;
  className: string;
  itemClassName: string;
  nameClassName: string;
  leading: ReactNode;
  // Sits after the name, and is the only thing that tells a screen reader these rows are not editable
  trailing: ReactNode;
}

/**
 * The read-only rows for the transformations a panel's plugin contributes.
 */
export function SystemTransformationList({
  transformations,
  position,
  className,
  itemClassName,
  nameClassName,
  leading,
  trailing,
}: SystemTransformationListProps) {
  if (transformations.length === 0) {
    return null;
  }

  return (
    <ul className={className} aria-label={getSystemTransformationsGroupLabel(position)}>
      {transformations.map((transformation, index) => {
        // A custom operator carries no id, so position is all that tells two of them apart.
        const id = typeof transformation === 'function' ? undefined : transformation.id;

        return (
          <li
            key={`${id ?? 'custom'}-${index}`}
            className={itemClassName}
            data-testid={selectors.components.Transforms.systemTransformationRow}
          >
            {leading}
            <span className={nameClassName}>{getSystemTransformationName(transformation)}</span>
            {trailing}
          </li>
        );
      })}
    </ul>
  );
}
