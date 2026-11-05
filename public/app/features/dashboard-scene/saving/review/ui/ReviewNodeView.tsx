import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Text, useStyles2 } from '@grafana/ui';

import { type ReviewNode, type SectionReviewNode } from '../types';

import { ReviewChangeList } from './ReviewChangeList';
import { ReviewDisclosure } from './ReviewDisclosure';
import { AddRemoveMarker, ElementIcon, RichTextView, isAddedOrRemoved, nodeElementKind } from './ReviewMarks';
import { ReviewPropertyList } from './ReviewPropertyList';
import { type ReviewExpansion } from './useReviewExpansion';

interface Props {
  node: ReviewNode;
  level: number;
  expansion: ReviewExpansion;
}

function hasContent(node: ReviewNode): boolean {
  return (
    (node.properties?.length ?? 0) > 0 ||
    node.categories.length > 0 ||
    (node.kind === 'section' &&
      (node.children.length > 0 || (node.removedContents?.length ?? 0) > 0 || (node.movedInContents?.length ?? 0) > 0))
  );
}

export function ReviewNodeView({ node, level, expansion }: Props) {
  const styles = useStyles2(getStyles);
  const children = node.kind === 'section' ? node.children : [];
  const removedContents = node.kind === 'section' ? (node.removedContents ?? []) : [];
  const movedInContents = node.kind === 'section' ? (node.movedInContents ?? []) : [];
  // A moved-in element that also changed is shown once, as its own collapsible line in its place in the list
  const childById = new Map(children.map((child) => [child.id, child]));
  const movedInNodes = movedInContents.map((_, index) =>
    node.kind === 'section' ? childById.get(node.movedInNodeIds?.[index] ?? '') : undefined
  );
  const placed = new Set(movedInNodes.flatMap((child) => (child ? [child.id] : [])));
  const otherChildren = children.filter((child) => !placed.has(child.id));
  const expandable = hasContent(node);
  const expanded = expandable ? expansion.isExpanded(nodeKey(node)) : undefined;
  // In the chevron's place, and the toggle when there is something to reveal. The label of an added or removed
  // node starts with the word, so the marker stays silent.
  const marker = isAddedOrRemoved(node.status) ? <AddRemoveMarker kind={node.status} decorative /> : undefined;

  const header = (
    <>
      {/* The spaces keep the parts apart in the accessible name; flex layout ignores them */}
      <span className={styles.title}>
        <ElementIcon kind={nodeElementKind(node)} />
        <Text weight="medium">
          <RichTextView text={node.label} capitalize />
        </Text>
      </span>{' '}
      {node.statusText && (
        <Text color="secondary">
          <RichTextView text={node.statusText} />
        </Text>
      )}{' '}
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
      onToggle={expandable ? () => expansion.toggle(nodeKey(node)) : undefined}
      lead={marker}
    >
      {node.properties?.length ? <ReviewPropertyList properties={node.properties} /> : null}
      {node.categories.map((group) => (
        <div key={group.category} className={styles.category}>
          <div role="heading" aria-level={Math.min(level + 1, 6)} className={styles.categoryHeading}>
            {group.label}
            {group.note && <span className={styles.categoryNote}> {group.note}</span>}
          </div>
          <ReviewChangeList changes={group.changes} />
        </div>
      ))}
      {movedInContents.length > 0 && (node.properties?.length ?? 0) > 0 && (
        <div role="heading" aria-level={Math.min(level + 1, 6)} className={styles.categoryHeading}>
          {t('dashboard-scene.review.moved-in-heading', 'Moved to it')}
        </div>
      )}
      {movedInContents.length > 0 && (
        <ul className={styles.movedInList}>
          {movedInContents.map((item, index) => {
            const child = movedInNodes[index];
            return child ? (
              <li key={child.id} className={styles.movedInNode}>
                <ReviewNodeView node={child} level={level + 1} expansion={expansion} />
              </li>
            ) : (
              <li key={index}>
                <RichTextView text={item} capitalize />
              </li>
            );
          })}
        </ul>
      )}
      {node.kind === 'section' && removedContents.length > 0 && (
        <RemovedContents node={node} level={level + 1} expansion={expansion} />
      )}
      {otherChildren.length > 0 && (
        <div className={styles.children}>
          {otherChildren.map((child) => (
            <ReviewNodeView key={child.id} node={child} level={level + 1} expansion={expansion} />
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
            <li key={index}>
              <RichTextView text={item} capitalize />
            </li>
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
    categoryNote: css({
      fontWeight: theme.typography.fontWeightRegular,
    }),
    categoryHeading: css({
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
    children: css({
      marginTop: theme.spacing(0.5),
    }),
    movedInList: css({
      margin: theme.spacing(0.5, 0, 1),
      paddingLeft: theme.spacing(2.5),
    }),
    // Its chevron takes the bullet's place, so its icon lines up with the other entries' icons
    movedInNode: css({
      listStyle: 'none',
      marginLeft: theme.spacing(-2.5),
    }),
    removedList: css({
      margin: 0,
      paddingLeft: theme.spacing(2.5),
      color: theme.colors.text.secondary,
    }),
  };
};
