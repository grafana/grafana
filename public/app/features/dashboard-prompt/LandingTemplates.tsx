import { css, cx } from '@emotion/css';
import { type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Button, FilterInput, Icon, Modal, useStyles2 } from '@grafana/ui';
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
  /** Keeps the panel out of sight while its lists still load, holding its place so the page does not shift. */
  hidden?: boolean;
  /** Called when a person opens or closes the panel, before it changes. */
  onToggle?: () => void;
  className?: string;
}

interface ListFilters {
  searchQuery?: string;
  sortOrder?: TemplateSortOrder;
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

/**
 * The templates under the new-dashboard prompt: a collapsible panel holding one row of the organization's custom
 * templates, then the Grafana-provisioned ones, which scrolls for the rest. "Browse all" opens every template in a
 * dialog with search and sort. Picking a card attaches it to the prompt instead of opening it. As pickers, both lists
 * render bare cards, so they flow into one grid.
 */
export function LandingTemplates({
  testDataSource,
  showGrafanaTemplates,
  showCustomTemplates,
  onSelectTemplate,
  selectedTemplateId,
  hidden,
  onToggle,
  className,
}: Props) {
  const styles = useStyles2(getStyles);
  const titleId = useId();
  const listId = useId();
  // Undefined until each list reports how many templates it shows.
  const [counts, setCounts] = useState<{ custom?: number; grafana?: number }>({});
  // A person's own toggle wins over the default.
  const [openedByUser, setOpenedByUser] = useState<boolean>();
  const [isBrowsing, setIsBrowsing] = useState(false);
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

  const onSelectFromDialog = (selection: TemplateSelection) => {
    onSelectTemplate(selection);
    setIsBrowsing(false);
  };

  // Rendered through a function, as in the template modal: the custom list is registered by the enterprise build.
  const renderLists = (
    onSelect: (selection: TemplateSelection) => void,
    { searchQuery, sortOrder }: ListFilters,
    onLoad?: { custom: (count: number) => void; grafana: (count: number) => void }
  ) => (
    <>
      {DashboardTemplatesTab && hasCustomTemplates && (
        <DashboardTemplatesTab
          isOpen
          onClose={noop}
          entryPoint={ENTRY_POINT}
          loadedFiredRef={customLoadedFiredRef}
          onSelectTemplate={onSelect}
          selectedTemplateId={selectedTemplateId}
          onTemplatesLoad={onLoad?.custom}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
        />
      )}
      {showGrafanaTemplates && (
        <GrafanaTemplatesTab
          entryPoint={ENTRY_POINT}
          testDataSource={testDataSource}
          onClose={noop}
          loadedFiredRef={grafanaLoadedFiredRef}
          onSelectTemplate={onSelect}
          selectedTemplateId={selectedTemplateId}
          onTemplatesLoad={onLoad?.grafana}
          searchQuery={searchQuery}
          sortOrder={sortOrder}
        />
      )}
    </>
  );

  return (
    <section
      className={cx(styles.panel, !isOpen && styles.panelClosed, hidden && styles.panelHidden, className)}
      aria-labelledby={titleId}
      aria-hidden={hidden || undefined}
    >
      <div className={styles.header}>
        <button
          type="button"
          id={titleId}
          className={styles.toggle}
          aria-expanded={isOpen}
          aria-controls={listId}
          onClick={() => {
            onToggle?.();
            setOpenedByUser(!isOpen);
          }}
        >
          <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
          <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
        </button>
        {isOpen && loaded && !isEmpty && (
          <Button size="sm" variant="secondary" fill="text" aria-haspopup="dialog" onClick={() => setIsBrowsing(true)}>
            <Trans i18nKey="dashboard.empty.templates-browse-all">Browse all</Trans>
          </Button>
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
        <div className={styles.grid} hidden={!loaded}>
          {renderLists(onSelectTemplate, {}, { custom: onCustomTemplatesLoad, grafana: onGrafanaTemplatesLoad })}
        </div>
      </div>
      {isBrowsing && (
        <BrowseTemplatesDialog
          onDismiss={() => setIsBrowsing(false)}
          renderLists={(filters) => renderLists(onSelectFromDialog, filters)}
        />
      )}
    </section>
  );
}

interface BrowseTemplatesDialogProps {
  onDismiss: () => void;
  renderLists: (filters: ListFilters) => ReactNode;
}

/** Every template in one grid, with the template modal's search and sort. Picking one closes the dialog. */
function BrowseTemplatesDialog({ onDismiss, renderLists }: BrowseTemplatesDialogProps) {
  const styles = useStyles2(getStyles);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<TemplateSortOrder>();

  return (
    <Modal
      isOpen
      onDismiss={onDismiss}
      className={styles.dialog}
      contentClassName={styles.dialogContent}
      title={t('dashboard-library.template-dashboard-modal.title', 'Start a dashboard from a template')}
    >
      <div className={styles.dialogFilters}>
        {/* Browse all is a search over every template, so typing starts at once. */}
        <FilterInput
          autoFocus
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
      </div>
      <div className={styles.grid}>{renderLists({ searchQuery, sortOrder })}</div>
      {searchQuery.trim() && (
        <p className={styles.noMatches}>
          <Trans i18nKey="dashboard-library.grafana-dashboard-template-modal.no-results-found">
            No template dashboards found
          </Trans>
        </p>
      )}
    </Modal>
  );
}

function getStyles(theme: GrafanaTheme2) {
  const gap = theme.spacing(2);
  // The toggle's height, and the header's.
  const headerHeight = theme.spacing(4);
  const listPaddingTop = theme.spacing(0.5);
  const peek = `${CARD_HEIGHT * NEXT_ROW_PEEK}px`;

  return {
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      // Same side inset as the prompt's text, so the label and cards line up with it.
      padding: theme.spacing(0, 1, 1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
    }),
    // Closed, the header sits as far from the panel's bottom edge as from the prompt above it: the same inset
    // the page leaves past the prompt's edge, since the header's height already centers its text.
    panelClosed: css({
      paddingBottom: theme.spacing(0.5),
    }),
    // Out of sight but in the layout, so the page, centered on its content, does not move when the panel shows.
    panelHidden: css({
      visibility: 'hidden',
    }),
    // A set height, so the Browse all button showing once the lists load does not move the cards.
    header: css({
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing(1),
      height: headerHeight,
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
    // One row and a sliver of the next; the rest scrolls.
    list: css({
      maxHeight: `calc(${CARD_HEIGHT}px + ${gap} + ${peek} + ${listPaddingTop})`,
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
      '&[hidden]': {
        display: 'none',
      },
    }),
    empty: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
    // The template modal's width.
    dialog: css({
      width: '1200px',
    }),
    dialogContent: css({
      paddingTop: 0,
    }),
    // Stays in view while the grid scrolls under it, as the template modal's header does.
    dialogFilters: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      display: 'flex',
      gap: theme.spacing(1),
      padding: theme.spacing(1, 0, 2),
      background: theme.flags.visualDesignRefresh ? theme.colors.background.page : theme.colors.background.primary,
    }),
    search: css({
      flex: 1,
      minWidth: 0,
    }),
    // As wide as its value, so it stays small until a person sorts. Flex, so the inline-flex select adds no line box.
    sort: css({
      display: 'flex',
      flexShrink: 0,
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
