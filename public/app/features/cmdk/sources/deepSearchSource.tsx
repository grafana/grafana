import { css } from '@emotion/css';
import { useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useFlagDashboardVectorSearch, useFlagGrafanaVectorSearchCmdk } from '@grafana/runtime/internal';
import { TagList, useStyles2 } from '@grafana/ui';
import {
  type DeepSearchDashboardResult,
  getDeepSearchResults,
} from 'app/features/commandPalette/actions/deepSearchActions';

import { registerCmdkSource } from '../registry';
import { type CmdkItem, type CmdkSource } from '../types';

const MAX_DEEP_SEARCH_RESULTS = 5;

// Vector search is slower than the keyword search, so wait longer before firing.
const DEEP_SEARCH_DEBOUNCE_MS = 500;

// Below everything else so the semantic matches don't push exact keyword matches around.
export const DEEP_SEARCH_PRIORITY = 0;

// Section id matches the old palette's sectionId slug so analytics stay comparable.
export const SECTION_DEEP_SEARCH = 'deep-search';

// Separator the backend uses to join the snippet breadcrumb segments.
const BREADCRUMB_SEPARATOR = ' → ';

// Resolves after ms, or as soon as the signal aborts (the caller checks aborted afterwards).
function debounceWait(ms: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, ms);
    abortSignal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

/**
 * Semantic (vector) dashboard search. Reuses the old palette's getDeepSearchResults which queries the vector
 * endpoint with panel-level matches and groups them per dashboard; here the dashboards render as regular items
 * in their own section instead of the old separate column.
 */
export function createDeepSearchSource(): CmdkSource {
  return {
    providedSections: [
      { id: SECTION_DEEP_SEARCH, title: t('command-palette.section.deep-search', 'Dashboards deep search') },
    ],

    async query(query, abortSignal): Promise<CmdkItem[]> {
      if (query.trim().length === 0) {
        return [];
      }

      await debounceWait(DEEP_SEARCH_DEBOUNCE_MS, abortSignal);
      if (abortSignal.aborted) {
        return [];
      }

      let results;
      try {
        // No snippet cap — the detail pane has room to show every matched panel.
        results = await getDeepSearchResults(query, abortSignal, Number.POSITIVE_INFINITY);
      } catch (error) {
        if (abortSignal.aborted) {
          return [];
        }
        // The vector backend may be unconfigured (501) or the feature toggle off (404) — registration gates on
        // the toggles, so degrade to an empty section but log for anyone hitting this without the gate.
        console.error('Deep search failed. The vector search backend may be unavailable.', error);
        return [];
      }

      return results.slice(0, MAX_DEEP_SEARCH_RESULTS).map(
        (result): CmdkItem => ({
          type: 'navigation',
          id: `deep-search/${result.dashboardUid}`,
          sectionId: SECTION_DEEP_SEARCH,
          title: result.title,
          priority: DEEP_SEARCH_PRIORITY,
          href: result.url,
          subtitle: result.folderTitle,
          // Tags are intentionally not on the list item to keep the row compact; they show in the detail.
          renderDetail: () => <DeepSearchItemDetail result={result} />,
        })
      );
    },
  };
}

/**
 * Detail for a focused deep search item, shown in the right hand side of the split view: the matched panel
 * snippets that the flat list row has no room for.
 */
function DeepSearchItemDetail({ result }: { result: DeepSearchDashboardResult }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.detail}>
      {result.folderTitle && <div className={styles.folder}>{result.folderTitle} /</div>}
      <div className={styles.title}>{result.title}</div>
      {result.tags.length > 0 && <TagList tags={result.tags} className={styles.tagList} displayMax={5} />}
      <div className={styles.heading}>{t('cmdk.deep-search.matched-panels', 'Matched panels')}</div>
      {result.snippets.map((snippet, index) => {
        // The snippet is the remainder of the backend breadcrumb (panelTitle → description). The exact segments
        // are not guaranteed, so treat the first as the panel title and anything after it as the description.
        const segments = snippet.text.split(BREADCRUMB_SEPARATOR);
        const title = segments[0];
        const description = segments.slice(1).join(BREADCRUMB_SEPARATOR);
        return (
          <div key={index} className={styles.snippetCard}>
            <div className={styles.snippetTitle}>{title}</div>
            {description && <div className={styles.snippetDescription}>{description}</div>}
          </div>
        );
      })}
      {result.matchedPanelCount > result.snippets.length && (
        <div className={styles.moreMatches}>
          {t('command-palette.deep-search.more-panels', '', {
            count: result.matchedPanelCount - result.snippets.length,
            defaultValue_one: '{{count}} more matched panel',
            defaultValue_other: '{{count}} more matched panels',
          })}
        </div>
      )}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    detail: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    folder: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
    }),
    title: css({
      fontWeight: theme.typography.fontWeightMedium,
    }),
    tagList: css({
      justifyContent: 'flex-start',
    }),
    heading: css({
      ...theme.typography.bodySmall,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.secondary,
      marginTop: theme.spacing(1),
    }),
    snippetCard: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(1),
    }),
    snippetTitle: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.primary,
      overflowWrap: 'anywhere',
    }),
    descriptionLabel: css({
      ...theme.typography.bodySmall,
      fontWeight: theme.typography.fontWeightMedium,
      color: theme.colors.text.disabled,
    }),
    snippetDescription: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.secondary,
      overflowWrap: 'anywhere',
    }),
    moreMatches: css({
      ...theme.typography.bodySmall,
      color: theme.colors.text.disabled,
    }),
  };
};

export function useRegisterDeepSearchSource() {
  // Both the backend vector-search endpoint flag and the command-palette flag must be on.
  const dashboardVectorSearchEnabled = useFlagDashboardVectorSearch();
  const vectorSearchCmdkEnabled = useFlagGrafanaVectorSearchCmdk();
  const enabled = dashboardVectorSearchEnabled && vectorSearchCmdkEnabled;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    return registerCmdkSource(createDeepSearchSource());
  }, [enabled]);
}
