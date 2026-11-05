import { css } from '@emotion/css';
import { upperFirst } from 'lodash';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { type ReviewNode, type SectionReviewNode } from '../types';

import { ReviewChangeList } from './ReviewChangeList';
import { ReviewDisclosure } from './ReviewDisclosure';
import { ElementIcon, MarkerSlot, isAddedOrRemoved, nodeElementKind } from './ReviewMarks';
import { type ReviewExpansion } from './useReviewExpansion';

interface Props {
  node: ReviewNode;
  level: number;
  expansion: ReviewExpansion;
  /** True when a sibling is added or removed: reserve the marker column so the headers line up. */
  markerColumn: boolean;
}

/** Whether a list of sibling nodes needs the marker column. */
export function needsMarkerColumn(nodes: ReviewNode[]): boolean {
  return nodes.some((node) => isAddedOrRemoved(node.status));
}

export function ReviewNodeView({ node, level, expansion, markerColumn }: Props) {
  const styles = useStyles2(getStyles);
  const children = node.kind === 'section' ? node.children : [];
  const removedContents = node.kind === 'section' ? (node.removedContents ?? []) : [];
  const hasContent = node.categories.length > 0 || children.length > 0 || removedContents.length > 0;
  const expanded = hasContent ? expansion.isExpanded(nodeKey(node)) : undefined;
  const childMarkerColumn = needsMarkerColumn(children);

  const header = (
    <>
      {/* The spaces keep the parts apart in the accessible name; flex layout ignores them */}
      <span className={styles.title}>
        {markerColumn && <MarkerSlot kind={node.status} />} <ElementIcon kind={nodeElementKind(node)} />
        <Text weight="medium">{upperFirst(node.label)}</Text>
      </span>{' '}
      {node.statusText && <Text color="secondary">{node.statusText}</Text>}{' '}
      {expanded === false && node.summary && (
        <Text variant="bodySmall" color="secondary">
          {node.summary}
        </Text>
      )}
    </>
  );

  return (
    <ReviewDisclosure
      level={level}
      header={header}
      expanded={expanded}
      onToggle={hasContent ? () => expansion.toggle(nodeKey(node)) : undefined}
    >
      {node.categories.map((group) => (
        <div key={group.category} className={styles.category}>
          <div role="heading" aria-level={Math.min(level + 1, 6)} className={styles.categoryHeading}>
            {group.label}
          </div>
          <ReviewChangeList changes={group.changes} />
        </div>
      ))}
      {node.kind === 'section' && removedContents.length > 0 && (
        <RemovedContents node={node} level={level + 1} expansion={expansion} />
      )}
      {children.length > 0 && (
        <div className={styles.children}>
          {children.map((child) => (
            <ReviewNodeView
              key={child.id}
              node={child}
              level={level + 1}
              expansion={expansion}
              markerColumn={childMarkerColumn}
            />
          ))}
        </div>
      )}
    </ReviewDisclosure>
  );
}

function RemovedContents({
  node,
  level,
  expansion,
}: {
  node: SectionReviewNode;
  level: number;
  expansion: ReviewExpansion;
}) {
  const styles = useStyles2(getStyles);
  const items = node.removedContents ?? [];
  const key = removedContentsKey(node);

  return (
    <div className={styles.category}>
      <ReviewDisclosure
        level={level}
        header={
          <Text variant="bodySmall" color="secondary" weight="medium">
            {t('dashboard-scene.review.removed-contents', '', {
              count: items.length,
              defaultValue_one: 'Removed with it ({{count}})',
              defaultValue_other: 'Removed with it ({{count}})',
            })}
          </Text>
        }
        expanded={expansion.isExpanded(key)}
        onToggle={() => expansion.toggle(key)}
      >
        <ul className={styles.removedList}>
          {items.map((item, index) => (
            <li key={index}>{upperFirst(item)}</li>
          ))}
        </ul>
      </ReviewDisclosure>
    </div>
  );
}

export function nodeKey(node: ReviewNode): string {
  return `node:${node.id}`;
}

export function removedContentsKey(node: ReviewNode): string {
  return `removed:${node.id}`;
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    title: css({
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
      minWidth: 0,
    }),
    category: css({
      margin: theme.spacing(0.5, 0, 1),
    }),
    categoryHeading: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    children: css({
      marginTop: theme.spacing(0.5),
    }),
    removedList: css({
      margin: 0,
      paddingLeft: theme.spacing(2.5),
      color: theme.colors.text.secondary,
    }),
  };
};
