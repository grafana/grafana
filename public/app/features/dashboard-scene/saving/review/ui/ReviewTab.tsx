import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import {
  Alert,
  Box,
  Button,
  EmptyState,
  LoadingPlaceholder,
  ScrollContainer,
  Stack,
  Text,
  useStyles2,
} from '@grafana/ui';

import { type ChangeKind, type ReviewNode, type ReviewSummary } from '../types';

import { ReviewChangeList } from './ReviewChangeList';
import { ReviewDisclosure } from './ReviewDisclosure';
import { AddRemoveMarker, RichTextView, isAddedOrRemoved } from './ReviewMarks';
import { ReviewNodeView, nodeKey, removedContentsKey } from './ReviewNodeView';
import { useReviewExpansion } from './useReviewExpansion';
import { type ReviewSummaryState } from './useReviewSummary';

const METADATA_KEY = 'metadata';
const SYSTEM_DEFAULTS_KEY = 'systemDefaults';
const COUNT_ORDER: ChangeKind[] = ['added', 'changed', 'removed', 'moved'];

export interface ReviewTabProps {
  state: ReviewSummaryState;
  onBackToDetails: () => void;
  /** Switches the drawer to the Changes tab, the fallback when the summary fails. */
  onShowChanges: () => void;
}

/** Read-only, human-friendly overview of what the save changes. Saving happens in Details. */
export function ReviewTab({ state, onBackToDetails, onShowChanges }: ReviewTabProps) {
  return (
    <Box display="flex" direction="column" height="100%">
      <ScrollContainer showScrollIndicators>
        <Box padding={0.5}>
          {(state.status === 'loading' || (state.status === 'ready' && state.refreshing)) && (
            <LoadingPlaceholder text={t('dashboard-scene.review.loading', 'Summarizing changes…')} />
          )}
          {state.status === 'error' && (
            <Alert severity="warning" title={t('dashboard-scene.review.error-title', 'Unable to summarize changes')}>
              <Button variant="primary" fill="text" size="sm" onClick={onShowChanges}>
                <Trans i18nKey="dashboard-scene.review.error-show-changes">See the technical diff in Changes</Trans>
              </Button>
            </Alert>
          )}
          {state.status === 'ready' && <ReviewSummaryView summary={state.summary} />}
        </Box>
      </ScrollContainer>
      <Box paddingTop={2}>
        <Button variant="secondary" icon="arrow-left" onClick={onBackToDetails}>
          <Trans i18nKey="dashboard-scene.review.back-to-details">Back to details</Trans>
        </Button>
      </Box>
    </Box>
  );
}

function ReviewSummaryView({ summary }: { summary: ReviewSummary }) {
  const styles = useStyles2(getStyles);
  const collapsedByDefault = useMemo(
    () =>
      new Set([
        ...detailOnlyKeys(summary.tree),
        ...(summary.collapsePanelsByDefault ? collapsibleKeys(summary.tree) : []),
      ]),
    [summary]
  );
  const expansion = useReviewExpansion(
    (key) => key !== METADATA_KEY && key !== SYSTEM_DEFAULTS_KEY && !collapsedByDefault.has(key)
  );

  const { tree, metadata, systemDefaults, overview } = summary;
  const systemDefaultsCount = systemDefaults.reduce((count, group) => count + group.changes.length, 0);

  if (tree.length === 0 && metadata.length === 0 && systemDefaultsCount === 0) {
    return <EmptyState variant="completed" message={t('dashboard.review.no-changes', 'No changes to save')} />;
  }

  const counts = COUNT_ORDER.filter((kind) => overview.counts[kind] > 0);

  return (
    <Stack direction="column" gap={2}>
      <Stack direction="column" gap={1}>
        <ReviewIntro summary={summary} />
        {tree.length === 0 ? (
          <Text element="p">
            <Trans i18nKey="dashboard-scene.review.only-outside-content">
              No changes to the dashboard content. Expand the sections below to see what else will be saved.
            </Trans>
          </Text>
        ) : (
          overview.line && (
            <Text element="p" weight="medium">
              {overview.line}
            </Text>
          )
        )}
        <div className={styles.toolbar}>
          {counts.length > 0 && (
            <ul className={styles.counts}>
              {counts.map((kind) => (
                <li key={kind} className={styles.count}>
                  {/* The same + and − that mark added and removed items below; the text says the word */}
                  {isAddedOrRemoved(kind) && <AddRemoveMarker kind={kind} decorative />}
                  <Text color="secondary">{formatCount(kind, overview.counts[kind])}</Text>
                </li>
              ))}
            </ul>
          )}
          <Stack gap={0}>
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon="table-expand-all"
              onClick={() => expansion.setAll(true)}
            >
              <Trans i18nKey="dashboard-scene.review.expand-all">Expand all</Trans>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              fill="text"
              icon="table-collapse-all"
              onClick={() => expansion.setAll(false)}
            >
              <Trans i18nKey="dashboard-scene.review.collapse-all">Collapse all</Trans>
            </Button>
          </Stack>
        </div>
      </Stack>

      {tree.length > 0 && (
        <div className={styles.tree}>
          {tree.map((node) => (
            <ReviewNodeView key={node.id} node={node} level={3} expansion={expansion} />
          ))}
        </div>
      )}

      {(metadata.length > 0 || systemDefaultsCount > 0) && (
        <div className={styles.extras}>
          {metadata.length > 0 && (
            <ReviewDisclosure
              level={3}
              header={
                <Text weight="medium">
                  {t('dashboard-scene.review.metadata-heading', '', {
                    count: metadata.length,
                    defaultValue_one: 'Metadata ({{count}})',
                    defaultValue_other: 'Metadata ({{count}})',
                  })}
                </Text>
              }
              expanded={expansion.isExpanded(METADATA_KEY)}
              onToggle={() => expansion.toggle(METADATA_KEY)}
            >
              <ReviewChangeList changes={metadata} />
            </ReviewDisclosure>
          )}
          {systemDefaultsCount > 0 && (
            <ReviewDisclosure
              level={3}
              header={
                <Text weight="medium">
                  {t('dashboard-scene.review.system-defaults-heading', '', {
                    count: systemDefaultsCount,
                    defaultValue_one: 'System defaults ({{count}})',
                    defaultValue_other: 'System defaults ({{count}})',
                  })}
                </Text>
              }
              expanded={expansion.isExpanded(SYSTEM_DEFAULTS_KEY)}
              onToggle={() => expansion.toggle(SYSTEM_DEFAULTS_KEY)}
            >
              <Text element="p" color="secondary" variant="bodySmall">
                {t(
                  'dashboard-scene.review.system-defaults-note',
                  "Values Grafana filled in automatically. You didn't edit them."
                )}
              </Text>
              {systemDefaults.map((group, index) => (
                <div key={index} className={styles.defaultsGroup}>
                  <div role="heading" aria-level={4} className={styles.groupHeading}>
                    <RichTextView text={group.label} capitalize />
                  </div>
                  <ReviewChangeList changes={group.changes} />
                </div>
              ))}
            </ReviewDisclosure>
          )}
        </div>
      )}
    </Stack>
  );
}

function ReviewIntro({ summary }: { summary: ReviewSummary }) {
  if (summary.mode === 'new') {
    return (
      <Text element="p">
        <Trans i18nKey="dashboard-scene.review.intro-new">This creates a new dashboard with:</Trans>
      </Text>
    );
  }

  return (
    <>
      {summary.mode === 'saveAsCopy' && (
        <Text element="p">
          {t(
            'dashboard-scene.review.intro-save-as-copy',
            'This saves a copy of "{{title}}". The original dashboard isn\'t changed. Differences from the original:',
            { title: summary.sourceTitle ?? '', interpolation: { escapeValue: false } }
          )}
        </Text>
      )}
      {summary.baselineKind === 'pendingChanges' && (
        <Text element="p" color="secondary" variant="bodySmall">
          <Trans i18nKey="dashboard-scene.review.baseline-pending-changes">
            Compared with the pending changes, not the saved dashboard.
          </Trans>
        </Text>
      )}
    </>
  );
}

function formatCount(kind: ChangeKind, count: number): string {
  switch (kind) {
    case 'added':
      return t('dashboard-scene.review.count-added', '', {
        count,
        defaultValue_one: '{{count}} added',
        defaultValue_other: '{{count}} added',
      });
    case 'changed':
      return t('dashboard-scene.review.count-changed', '', {
        count,
        defaultValue_one: '{{count}} changed',
        defaultValue_other: '{{count}} changed',
      });
    case 'removed':
      return t('dashboard-scene.review.count-removed', '', {
        count,
        defaultValue_one: '{{count}} removed',
        defaultValue_other: '{{count}} removed',
      });
    case 'moved':
      return t('dashboard-scene.review.count-moved', '', {
        count,
        defaultValue_one: '{{count}} moved',
        defaultValue_other: '{{count}} moved',
      });
  }
}

/** Expansion keys of the parts that start collapsed on a large review: panels and "removed with it" lists. */
function collapsibleKeys(nodes: ReviewNode[]): string[] {
  return nodes.flatMap((node) => {
    if (node.kind === 'panel') {
      return [nodeKey(node)];
    }
    return node.kind === 'section' ? [removedContentsKey(node), ...collapsibleKeys(node.children)] : [];
  });
}

/**
 * Added and removed nodes whose content is only what they are set to (and, for a new section, what moved into it):
 * the header says what happened, the details are one click away.
 */
function detailOnlyKeys(nodes: ReviewNode[]): string[] {
  return nodes.flatMap((node) => {
    const children = node.kind === 'section' ? node.children : [];
    const detailOnly =
      (node.status === 'added' || node.status === 'removed') &&
      node.categories.length === 0 &&
      children.length === 0 &&
      !(node.kind === 'section' && node.removedContents?.length);
    return [...(detailOnly ? [nodeKey(node)] : []), ...detailOnlyKeys(children)];
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  toolbar: css({
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  counts: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0, 2),
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  count: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  tree: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  extras: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    paddingTop: theme.spacing(1),
    borderTop: `1px solid ${theme.colors.border.weak}`,
  }),
  defaultsGroup: css({
    marginTop: theme.spacing(1),
  }),
  groupHeading: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
