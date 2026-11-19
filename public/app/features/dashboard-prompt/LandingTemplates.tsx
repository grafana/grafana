import { css, cx } from '@emotion/css';
import { useCallback, useEffect, useId, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { FilterInput, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { SortPicker } from 'app/core/components/Select/SortPicker';
import { DashboardCard } from 'app/features/dashboard/dashgrid/DashboardLibrary/DashboardCard';
import { GrafanaTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelection, type TemplateSortOrder } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';
import { getTemplateSortOptions } from 'app/features/dashboard/dashgrid/DashboardLibrary/utils/templateFilters';

interface Props {
  testDataSource: DataSourceInstanceListItem | undefined;
  showGrafanaTemplates: boolean;
  showCustomTemplates: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
  /** Keeps the panel out of view while its lists still load. */
  hidden?: boolean;
  /**
   * The most height the panel may take, as a CSS length, below any top padding `className` adds. The grid then
   * shows the whole rows that fit and a sliver of the next, and scrolls the rest.
   */
  maxHeight?: string;
  className?: string;
}

const noop = () => {};

/** Every card's height: the thumbnail takes what the title and author lines leave. */
const CARD_HEIGHT = 160;
/** How much of the next row shows under the last whole one, so a longer list reads as one that scrolls. */
const NEXT_ROW_PEEK = 0.1;
/** Two rows on a desktop, enough to fill the panel while the lists load. */
const LOADING_CARDS = 8;
/** How long the cards wait for every list before showing the ones that have loaded. */
export const LOAD_WAIT_MS = 3000;

/**
 * The templates under the new-dashboard prompt: a collapsible panel holding one scrollable grid, the
 * organization's custom templates first, then the Grafana-provisioned ones. Picking a card attaches it to the
 * prompt instead of opening it. As pickers, both lists render bare cards, so they flow into this one grid.
 */
export function LandingTemplates({
  testDataSource,
  showGrafanaTemplates,
  showCustomTemplates,
  onSelectTemplate,
  selectedTemplateId,
  hidden,
  maxHeight,
  className,
}: Props) {
  const styles = useStyles2(getStyles, maxHeight);
  const titleId = useId();
  const listId = useId();
  // Undefined until each list reports how many templates it shows.
  const [counts, setCounts] = useState<{ custom?: number; grafana?: number }>({});
  // A person's own toggle wins over the default.
  const [openedByUser, setOpenedByUser] = useState<boolean>();
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
  // Open while the lists load and when they show templates; closed when there are none to show.
  const isOpen = openedByUser ?? !isEmpty;
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
    <section
      className={cx(styles.panel, !isOpen && styles.panelClosed, className)}
      aria-labelledby={titleId}
      hidden={hidden}
    >
      <div className={styles.header}>
        <button
          type="button"
          id={titleId}
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => setOpenedByUser(!isOpen)}
        >
          <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </button>
        {isOpen && loaded && !isEmpty && (
          <div className={styles.filters}>
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
                width={22}
              />
            </div>
          </div>
        )}
      </div>
      {/* Hidden, not unmounted: reopening keeps the loaded templates instead of refetching them. */}
      <div id={listId} className={styles.list} hidden={!isOpen}>
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
                entryPoint=""
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

function getStyles(theme: GrafanaTheme2, maxHeight?: string) {
  const gap = theme.spacing(2);
  const headerHeight = theme.spacing(4);
  const listPaddingTop = theme.spacing(0.5);
  const row = `(${CARD_HEIGHT}px + ${gap})`;
  const peek = `${CARD_HEIGHT * NEXT_ROW_PEEK}px`;
  // What the panel draws around its list: the borders, the header and the bottom padding.
  const panelChrome = `(2px + ${headerHeight} + ${theme.spacing(1)})`;
  // At least one row, so a short screen still shows a whole card; the panel shrinks below that if it must.
  const listMaxHeight =
    maxHeight &&
    `calc(max(${row}, round(down, ${maxHeight} - ${panelChrome} - ${listPaddingTop} - ${peek}, ${row})) + ${listPaddingTop} + ${peek})`;

  return {
    // Shrinks with the page and scrolls its grid, so the content below the panel stays in view.
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      // Same side inset as the prompt's text, so the label and cards line up with it.
      padding: theme.spacing(0, 1, 1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      '&[hidden]': {
        display: 'none',
      },
    }),
    // Closed, the header sits as far from the panel's bottom edge as from the prompt above it: the same inset
    // the page leaves past the prompt's edge, since the header's height already centers its text.
    panelClosed: css({
      paddingBottom: theme.spacing(0.5),
    }),
    // A set height, which the list's height accounts for; the search and sort fit in it.
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      height: headerHeight,
    }),
    filters: css({
      display: 'flex',
      gap: theme.spacing(1),
      minWidth: 0,
      marginLeft: 'auto',
    }),
    search: css({
      width: theme.spacing(25),
      minWidth: 0,
    }),
    // A phone keeps the header to the toggle and the search.
    sort: css({
      [theme.breakpoints.down('sm')]: {
        display: 'none',
      },
    }),
    toggle: css({
      flexShrink: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      height: headerHeight,
      padding: 0,
      background: 'none',
      border: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    list: css({
      minHeight: 0,
      maxHeight: listMaxHeight,
      overflowY: 'auto',
      paddingTop: listPaddingTop,
      '&[hidden]': {
        display: 'none',
      },
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
