import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, Icon, useStyles2 } from '@grafana/ui';
import { DashboardCard } from 'app/features/dashboard/dashgrid/DashboardLibrary/DashboardCard';
import { GrafanaTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab';
import { TemplateFilters } from 'app/features/dashboard/dashgrid/DashboardLibrary/TemplateFilters';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelection, type TemplateSortOrder } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { getTemplateSortOptions } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/templateFilters';

interface Props {
  /** The panel's id, which its toggle in the prompt controls. */
  id?: string;
  /** Open or closed, as the toggle in the prompt sets it. Closed, the panel takes no room; its lists keep loading. */
  isOpen: boolean;
  testDataSource: DataSourceInstanceListItem | undefined;
  showGrafanaTemplates: boolean;
  showCustomTemplates: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
  /**
   * Called once the cards show, with how many templates each list offers (a list that is not shown, has not reported,
   * or failed has no count): when every list is done, or after `LOAD_WAIT_MS` when the loaded ones have templates, and
   * again as late lists report. The host reports what was on offer.
   */
  onTemplatesCount?: (counts: TemplateCounts) => void;
  className?: string;
}

export interface TemplateCounts {
  custom?: number;
  grafana?: number;
}

const noop = () => {};

/** Tags the templates' analytics and pages with this surface (a `DashboardTemplatesSourceEntryPointMap` key). */
const ENTRY_POINT = 'emptyDashboardPrompt';

/** Every card's height: the thumbnail takes what the title and author lines leave. */
const CARD_HEIGHT = 160;
/** How much of the next row shows under the first, so a longer list reads as one that scrolls. */
const NEXT_ROW_PEEK = 0.1;
/** A row on a desktop and the next one: the panel's loading cards, at the height the real ones take. */
const LOADING_CARDS = 8;
/** How long the cards wait for every list before showing the ones that have loaded. */
const LOAD_WAIT_MS = 1500;

interface ToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  /** The id of the panel it opens and closes. */
  controls?: string;
}

/** Opens and closes the templates panel, from the prompt's toolbar next to its + button. */
export function LandingTemplatesToggle({ isOpen, onToggle, controls }: ToggleProps) {
  const styles = useStyles2(getToggleStyles);
  return (
    <Button
      size="sm"
      variant="secondary"
      fill="text"
      className={cx(styles.toggle, isOpen && styles.toggleOpen)}
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={onToggle}
    >
      <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
      <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
    </Button>
  );
}

/**
 * The templates under the new-dashboard prompt: a panel with the template modal's search and sort, and one row of
 * the organization's custom templates, then the Grafana-provisioned ones, which scrolls for the rest. Picking a card
 * attaches it to the prompt instead of opening it. As pickers, both lists render bare cards, so they flow into one
 * grid.
 */
export function LandingTemplates({
  id,
  isOpen,
  testDataSource,
  showGrafanaTemplates,
  showCustomTemplates,
  onSelectTemplate,
  selectedTemplateId,
  onTemplatesCount,
  className,
}: Props) {
  const styles = useStyles2(getStyles);
  // Undefined until each list reports how many templates it shows.
  const [counts, setCounts] = useState<TemplateCounts>({});
  // The template modal's search and sort, applied to every list.
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<TemplateSortOrder>();
  // The lists that are done: loaded with a count, or failed without one, so a failure is not read as none.
  const [reported, setReported] = useState<Partial<Record<keyof TemplateCounts, true>>>({});
  const reportLoad = useCallback((list: keyof TemplateCounts, count?: number) => {
    setReported((current) => ({ ...current, [list]: true }));
    if (count !== undefined) {
      setCounts((current) => ({ ...current, [list]: count }));
    }
  }, []);
  const onCustomTemplatesLoad = useCallback((count?: number) => reportLoad('custom', count), [reportLoad]);
  const onGrafanaTemplatesLoad = useCallback((count?: number) => reportLoad('grafana', count), [reportLoad]);
  // Registered by the enterprise build; `showCustomTemplates` is only set when it is.
  const DashboardTemplatesTab = showCustomTemplates ? getDashboardTemplatesTab() : null;
  const allLoaded = (!showCustomTemplates || reported.custom) && (!showGrafanaTemplates || reported.grafana);
  const total = (counts.custom ?? 0) + (counts.grafana ?? 0);
  // A slow list must not hold back the cards the others loaded.
  const [waitedLong, setWaitedLong] = useState(false);
  useEffect(() => {
    if (allLoaded) {
      return;
    }
    const timeout = setTimeout(() => setWaitedLong(true), LOAD_WAIT_MS);
    return () => clearTimeout(timeout);
  }, [allLoaded]);
  const loaded = allLoaded || (waitedLong && total > 0);
  const isEmpty = allLoaded && total === 0;
  useEffect(() => {
    if (loaded) {
      onTemplatesCount?.(counts);
    }
  }, [loaded, counts, onTemplatesCount]);
  // Pre-set so the lists send no `loaded` events here: the panel shows on every new-dashboard visit, which page views
  // already count, and the prompt's send event carries the counts.
  const loadedFiredRef = useRef(true);

  // Rendered through a function, as in the template modal: the tab comes from a registry at render time.
  const renderCustomTemplates = () => {
    if (!DashboardTemplatesTab) {
      return null;
    }
    return (
      <DashboardTemplatesTab
        isOpen
        onClose={noop}
        entryPoint={ENTRY_POINT}
        loadedFiredRef={loadedFiredRef}
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={selectedTemplateId}
        onTemplatesLoad={onCustomTemplatesLoad}
        searchQuery={searchQuery}
        sortOrder={sortOrder}
      />
    );
  };

  return (
    // Hidden, not unmounted: reopening keeps the loaded templates instead of refetching them.
    <section
      id={id}
      className={cx(styles.panel, className)}
      aria-label={t('dashboard.empty.templates-title', 'Start from a template')}
      hidden={!isOpen}
    >
      <div className={styles.header}>
        {loaded && !isEmpty && (
          // The template modal's filters, without the tag and creator ones that only custom templates carry.
          <TemplateFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortValue={sortOrder}
            onSortChange={(change) => setSortOrder(change?.value)}
            getSortOptions={getTemplateSortOptions}
          />
        )}
      </div>
      <div className={styles.list}>
        {isEmpty && (
          <p className={styles.empty}>
            <Trans i18nKey="dashboard.empty.templates-empty">No templates available</Trans>
          </p>
        )}
        {!loaded && (
          <div className={styles.grid}>
            {Array.from({ length: LOADING_CARDS }).map((_, index) => (
              <DashboardCard.Skeleton key={index} fluid />
            ))}
          </div>
        )}
        {/* Shown once every list has loaded, so the cards arrive together instead of reflowing list by list. */}
        <div hidden={!loaded}>
          <div className={styles.grid}>
            {renderCustomTemplates()}
            {showGrafanaTemplates && (
              <GrafanaTemplatesTab
                entryPoint={ENTRY_POINT}
                testDataSource={testDataSource}
                onClose={noop}
                loadedFiredRef={loadedFiredRef}
                onSelectTemplate={onSelectTemplate}
                selectedTemplateId={selectedTemplateId}
                onTemplatesLoad={onGrafanaTemplatesLoad}
                searchQuery={searchQuery}
                sortOrder={sortOrder}
              />
            )}
          </div>
          {searchQuery.trim() && (
            <p className={styles.noMatches}>
              <Trans i18nKey="dashboard-library.grafana-dashboard-template-modal.no-results-found">
                No template dashboards found
              </Trans>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

// As the edit pane's collapsible sections: the label is secondary until the panel opens, and a click leaves no
// background behind (a text button keeps its hover look while focused), so it reads as a section, not a dropdown.
function getToggleStyles(theme: GrafanaTheme2) {
  return {
    toggle: css({
      color: theme.colors.text.secondary,
      '&:focus:not(:hover)': {
        background: 'transparent',
        color: theme.colors.text.secondary,
      },
    }),
    toggleOpen: css({
      color: theme.colors.text.primary,
      '&:focus:not(:hover)': {
        color: theme.colors.text.primary,
      },
    }),
  };
}

function getStyles(theme: GrafanaTheme2) {
  const gap = theme.spacing(2);
  // Half a grid unit above and below the search and sort, which the insets around the header bring to about a unit
  // from the prompt and from the cards.
  const headerHeight = `calc(${theme.spacing(theme.components.height.md)} + ${theme.spacing(1)})`;
  const listPaddingTop = theme.spacing(0.5);
  const peek = `${CARD_HEIGHT * NEXT_ROW_PEEK}px`;

  return {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      // Same side inset as the prompt's text, so the search and cards line up with it.
      padding: theme.spacing(0, 1, 1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      '&[hidden]': {
        display: 'none',
      },
    }),
    // A set height, so the row keeps its height while the lists load and the cards do not jump.
    header: css({
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      height: headerHeight,
    }),
    // One row and a sliver of the next; the rest scrolls. A set height, so neither a search that matches less nor the
    // loading cards move the page.
    list: css({
      height: `calc(${CARD_HEIGHT}px + ${gap} + ${peek} + ${listPaddingTop})`,
      overflowY: 'auto',
      paddingTop: listPaddingTop,
    }),
    // As many columns as fit at the minimum card width, four at most.
    grid: css({
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fill, minmax(max(${theme.spacing(22)}, (100% - 3 * ${gap}) / 4), 1fr))`,
      gridAutoRows: CARD_HEIGHT,
      gap,
    }),
    empty: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    // Shown while a search is on and no list has a card for it.
    noMatches: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      'div:has(> article) + &': {
        display: 'none',
      },
    }),
  };
}
