import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, FilterInput, Icon, useStyles2 } from '@grafana/ui';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { DashboardCard } from 'app/features/dashboard/dashgrid/DashboardLibrary/DashboardCard';
import { GrafanaTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelection, type TemplateSortOrder } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { getTemplateSortOptions } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/templateFilters';

interface Props {
  /** The panel's id, which its toggle in the prompt controls. */
  id?: string;
  /** Open or closed, as the toggle in the prompt sets it. Closed, the panel takes no room; its lists stay loaded. */
  isOpen: boolean;
  testDataSource: DataSourceInstanceListItem | undefined;
  showGrafanaTemplates: boolean;
  showCustomTemplates: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
  /** Called with whether the lists turned out to have no templates, so the host can start the panel closed. */
  onEmptyChange?: (isEmpty: boolean) => void;
  /** Keeps the panel out of sight while its lists still load, holding its place so the page does not shift. */
  hidden?: boolean;
  className?: string;
}

const noop = () => {};

/** Tags the templates' analytics and pages with this surface (a `DashboardTemplatesSourceEntryPointMap` key). */
const ENTRY_POINT = 'emptyDashboardPrompt';

/** Every card's height: the thumbnail takes what the title and author lines leave. */
const CARD_HEIGHT = 160;
/** How much of the next row shows under the first, so a longer list reads as one that scrolls. */
const NEXT_ROW_PEEK = 0.1;
/** A row on a desktop and the next one, enough to fill the panel while the lists load. */
const LOADING_CARDS = 8;
/** How long the cards wait for every list before showing the ones that have loaded. */
export const LOAD_WAIT_MS = 3000;

interface ToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  /** The id of the panel it opens and closes. */
  controls?: string;
}

/** Opens and closes the templates panel, from the prompt's toolbar next to its + button. */
export function LandingTemplatesToggle({ isOpen, onToggle, controls }: ToggleProps) {
  return (
    <Button
      size="sm"
      variant="secondary"
      fill="text"
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
  onEmptyChange,
  hidden,
  className,
}: Props) {
  const styles = useStyles2(getStyles);
  // Undefined until each list reports how many templates it shows.
  const [counts, setCounts] = useState<{ custom?: number; grafana?: number }>({});
  // The template modal's search and sort, applied to every list.
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<TemplateSortOrder>();
  const onCustomTemplatesLoad = useCallback((custom: number) => setCounts((current) => ({ ...current, custom })), []);
  const onGrafanaTemplatesLoad = useCallback(
    (grafana: number) => setCounts((current) => ({ ...current, grafana })),
    []
  );
  const DashboardTemplatesTab = getDashboardTemplatesTab();
  const hasCustomTemplates = Boolean(DashboardTemplatesTab) && showCustomTemplates;
  const allLoaded =
    (!hasCustomTemplates || counts.custom !== undefined) && (!showGrafanaTemplates || counts.grafana !== undefined);
  const total = (counts.custom ?? 0) + (counts.grafana ?? 0);
  // A list that never reports (an older enterprise build) must not hold back the cards the others loaded.
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
    onEmptyChange?.(isEmpty);
  }, [isEmpty, onEmptyChange]);
  // Pre-set so the lists' `loaded` events, which report the template modal as their location, stay silent here.
  const customLoadedFiredRef = useRef(true);
  const grafanaLoadedFiredRef = useRef(true);

  // Rendered through a function, as in the template modal: the tab is registered by the enterprise build.
  const renderCustomTemplates = () => {
    if (!DashboardTemplatesTab || !hasCustomTemplates) {
      return null;
    }
    return (
      <DashboardTemplatesTab
        isOpen
        onClose={noop}
        entryPoint={ENTRY_POINT}
        loadedFiredRef={customLoadedFiredRef}
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
      className={cx(styles.panel, hidden && styles.panelHidden, className)}
      aria-label={t('dashboard.empty.templates-title', 'Start from a template')}
      aria-hidden={hidden || undefined}
      hidden={!isOpen}
    >
      {!isEmpty && (
        <div className={styles.header}>
          {loaded && (
            <>
              <FilterInput
                className={styles.search}
                placeholder={t('dashboard-library.custom-dashboard-template-filters.search-placeholder', 'Search')}
                value={searchQuery}
                escapeRegex={false}
                onChange={setSearchQuery}
              />
              <div className={styles.sort}>
                <SortPicker
                  value={sortOrder}
                  onChange={(change) => setSortOrder(change?.value)}
                  getSortOptions={getTemplateSortOptions}
                  placeholder={t('dashboard-library.custom-dashboard-template-filters.sort-placeholder', 'Sort')}
                  isClearable
                  width="auto"
                />
              </div>
            </>
          )}
        </div>
      )}
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
                loadedFiredRef={grafanaLoadedFiredRef}
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
    // Out of sight but in the layout, so the page, centered on its content, does not move when the panel shows.
    panelHidden: css({
      visibility: 'hidden',
    }),
    // A set height, kept while the search and sort load so the cards do not jump.
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      height: headerHeight,
    }),
    // The main control: it takes the room the sort leaves, up to a cap, and gives it up first.
    search: css({
      flex: 1,
      minWidth: 0,
      maxWidth: theme.spacing(32),
    }),
    // As wide as its value, so it stays small until a person sorts, at the far end of the row. Flex, so the
    // inline-flex select adds no line box. A phone keeps the row to the search.
    sort: css({
      display: 'flex',
      flexShrink: 0,
      marginLeft: 'auto',
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
    // One row and a sliver of the next; the rest scrolls.
    list: css({
      maxHeight: `calc(${CARD_HEIGHT}px + ${gap} + ${peek} + ${listPaddingTop})`,
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
    // Shown while a search is on and no list has a card for it.
    noMatches: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      'div:has(> article) + &': {
        display: 'none',
      },
    }),
    empty: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
