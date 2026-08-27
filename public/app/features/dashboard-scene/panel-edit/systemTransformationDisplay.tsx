import { type ReactNode } from 'react';

import { type CustomTransformOperator, type DataTransformerConfig, standardTransformersRegistry } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { type SystemTransformationPosition } from '@grafana/scenes';
import { Badge } from '@grafana/ui';

// Wording and markup shared by both transformation editors: the same transformation must not be
// named one thing in one editor and something else in the other, and the two lists must not drift
// apart on how they are keyed, grouped for assistive tech, or found by a test.

/**
 * Display name for a transformation the panel's plugin contributes. A custom operator carries no id,
 * so it can only be named generically.
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

export function getSystemTransformationTooltip(): string {
  return t('dashboard-scene.system-transformations.tooltip-system', 'Added automatically by the panel. Read-only.');
}

/**
 * Names a group of these rows for assistive tech. Both editors place the groups above and below the
 * editable rows, and that placement is the only thing telling a sighted user when they run.
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
  /** Class for the list element. */
  className: string;
  /** Class for each row. */
  itemClassName: string;
  /** Class for the transformation's name. */
  nameClassName: string;
  /** Sits before the name. Decorative: the name and `trailing` carry the meaning between them. */
  leading: ReactNode;
  /**
   * Sits after the name, and is the only thing that tells a screen reader these rows are not
   * editable — so it has to say so in text or in a title. The editors differ on how, because one has
   * room for a badge beside the name and the other does not.
   */
  trailing: ReactNode;
}

/**
 * The read-only rows for the transformations a panel's plugin contributes.
 *
 * Both editors render the same list: same grouping label, same keys, same test id. Only the styling
 * and the two affordances around the name differ, so those are passed in and everything else lives
 * here — a change to how a row is keyed or found has one place to happen rather than two that can
 * silently disagree.
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
