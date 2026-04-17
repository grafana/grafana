import { css, cx } from '@emotion/css';
import { take } from 'lodash';
import { useState } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { type SceneQueryRunner } from '@grafana/scenes';
import {
  Button,
  LoadingBar,
  ScrollContainer,
  Stack,
  Text,
  useSplitter,
  useStyles2,
} from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import LoadMoreHelper from '../rule-list/LoadMoreHelper';

import { WorkbenchProvider, useExpandCollapseAll } from './WorkbenchContext';
import { useTriageWorkbenchInitialOutcomeAnalytics } from './hooks/useTriageWorkbenchInitialOutcomeAnalytics';
import { AlertRuleRow } from './rows/AlertRuleRow';
import { FolderGroupRow } from './rows/FolderGroupRow';
import { GroupRow } from './rows/GroupRow';
import { generateRowKey } from './rows/utils';
import { GenericRowSkeleton } from './scene/AlertRuleInstances';
import { SummaryChartReact } from './scene/SummaryChart';
import { WorkbenchEmptyState } from './scene/WorkbenchEmptyState';
import { LabelsColumn } from './scene/filters/LabelsColumn';
import { type Domain, EmptyLabelValue, type Filter, type WorkbenchRow } from './types';

type WorkbenchProps = {
  domain: Domain;
  data: WorkbenchRow[];
  groupBy?: string[];
  filterBy?: Filter[];
  queryRunner: SceneQueryRunner;
  isInitialLoading?: boolean;
  isRefreshing?: boolean;
  hasActiveFilters?: boolean;
};

const initialSize = 2 / 3;

// Helper function to recursively render WorkbenchRow items with children pattern
function renderWorkbenchRow(
  row: WorkbenchRow,
  leftColumnWidth: number,
  domain: Domain,
  key: React.Key,
  enableFolderMeta: boolean,
  depth = 0,
  groupLabels: Record<string, string> = {}
): React.ReactElement {
  if (row.type === 'alertRule') {
    return (
      <AlertRuleRow
        key={key}
        row={row}
        leftColumnWidth={leftColumnWidth}
        rowKey={key}
        depth={depth}
        enableFolderMeta={enableFolderMeta}
        groupLabels={groupLabels}
      />
    );
  } else {
    // Accumulate this group's label=value so child AlertRuleRows can scope their instance queries.
    // EmptyLabelValue (instances missing this label) maps to "" which produces label="" in PromQL.
    const childGroupLabels = {
      ...groupLabels,
      [row.metadata.label]: row.metadata.value === EmptyLabelValue ? '' : row.metadata.value,
    };

    const children = row.rows.map((childRow, childIndex) =>
      renderWorkbenchRow(
        childRow,
        leftColumnWidth,
        domain,
        `${key}-${generateRowKey(childRow, childIndex)}`,
        enableFolderMeta,
        depth + 1,
        childGroupLabels
      )
    );

    // Check if this is a grafana_folder group and use FolderGroupRow
    if (row.metadata.label === 'grafana_folder') {
      return (
        <FolderGroupRow key={key} row={row} leftColumnWidth={leftColumnWidth} rowKey={key} depth={depth}>
          {children}
        </FolderGroupRow>
      );
    }

    return (
      <GroupRow key={key} row={row} leftColumnWidth={leftColumnWidth} rowKey={key} depth={depth}>
        {children}
      </GroupRow>
    );
  }
}

/**
 * The workbench displays groups of alerts, each group containing metadata and a chart.
 * Alerts can be arbitrarily grouped by any number of labels. By default all instances are grouped by alertname.
 *
 * The page consist of a left column with metadata for the row and a right column with charts.
 * Below is a rough layout of the page:
 *
 * The page is divided into two columns, the size of these columns is determined by the splitter.
 * There is a useMeasure hook to measure the size of the left column, which is used to set the width of the group items.
 * We do this because each row needs to be a flex container such that if the height of the left colorn changes, the
 * right column will also change its height accordingly. This would not be possible if we used a simplified column layout.
 *
 * This also means we draw the rows _on top_ of the splitter, in other words the contents of the splitter are empty
 * and we only use it to determine the width of the left column of the rows that are overlayed on top.
 *
 * Each group is a row with a left and a right column. Each row consists of two cells (the left and the right cell).
 * The left cell contains the metadata for the group, the right cell contains the chart.
 ┌─────────────────────────┐ ┌───────────────────────────────────┐
 │┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
 │                                                               │
 ││                                                Row          ││
 │                                                               │
 │└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
 │┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐│
 │ ┌──────────────────────┐    ┌───────────────────────────────┐ │
 │││          Cell        │    │              Cell             │││
 │ └──────────────────────┘    └───────────────────────────────┘ │
 │└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│─│─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘│
 │                         │ │                                   │
 │                         │││                                   │
 │                         │││                                   │
 │                         │││                                   │
 │                         │ │                                   │
 │                         │ │                                   │
│                         │ │                                   │
└─────────────────────────┘ └───────────────────────────────────┘
 */
export function Workbench({
  domain,
  data,
  queryRunner,
  groupBy,
  isInitialLoading = false,
  isRefreshing = false,
  hasActiveFilters = false,
}: WorkbenchProps) {
  const styles = useStyles2(getStyles);

  const [pageIndex, setPageIndex] = useState<number>(1);
  const [allExpanded, setAllExpanded] = useState(true);
  const { expandGeneration, collapseGeneration, expandAll, collapseAll } = useExpandCollapseAll();

  const toggleExpandAll = () => {
    if (allExpanded) {
      collapseAll();
      setAllExpanded(false);
    } else {
      expandAll();
      setAllExpanded(true);
    }
  };

  // Calculate once: show folder metadata only if not grouping by grafana_folder
  const enableFolderMeta = !groupBy?.includes('grafana_folder');

  const showEmptyState = !isInitialLoading && data.length === 0;
  const showData = data.length > 0;

  useTriageWorkbenchInitialOutcomeAnalytics({
    isInitialLoading,
    rowCount: data.length,
    hasActiveFilters,
  });

  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 2/3 : 1/3, otherwise 100/0 because there is no payload editor
    initialSize: initialSize,
    dragPosition: 'middle',
  });

  // this will measure the size of the left most column of the splitter, so we can use it to set the width of the group items
  const [leftColumnRef, leftColumnRect] = useMeasure<HTMLDivElement>();
  const leftColumnWidth = leftColumnRect.width;
  const [rightColumnRef, rightColumnRect] = useMeasure<HTMLDivElement>();
  const rightColumnWidth = rightColumnRect.width;

  const itemsToRender = pageIndex * DEFAULT_PER_PAGE_PAGINATION;
  const dataSlice = take(data, itemsToRender);
  const hasMore = data.length > itemsToRender;

  return (
    <Stack gap={0} grow={1} width="100%" height="100%">
      {/* always-visible labels column */}
      <LabelsColumn />
      {/* main workbench: splitter + overlaid content */}
      <div style={{ position: 'relative', display: 'flex', flex: 1, minWidth: 0, height: '100%' }}>
        {/* dummy splitter to handle flex width of group items */}
        <div {...splitter.containerProps}>
          <div {...splitter.primaryProps}>
            <div ref={leftColumnRef} className={cx(styles.flexFull, styles.minColumnWidth)} />
          </div>
          {!showEmptyState && <div {...splitter.splitterProps} />}
          <div {...splitter.secondaryProps}>
            <div ref={rightColumnRef} className={cx(styles.flexFull, styles.minColumnWidth)} />
          </div>
        </div>
        {/* content goes here */}
        <div data-testid="groups-container" className={cx(splitter.containerProps.className, styles.groupsContainer)}>
          {showEmptyState ? (
            <WorkbenchEmptyState hasActiveFilters={hasActiveFilters} />
          ) : (
            <>
              <div className={cx(styles.groupItemWrapper(leftColumnWidth), styles.summaryContainer)}>
                <div />
                <SummaryChartReact />
              </div>
              {groupBy && groupBy.length > 0 && (
                <div className={styles.expandCollapseToolbar}>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={allExpanded ? 'table-collapse-all' : 'table-expand-all'}
                    onClick={toggleExpandAll}
                  >
                    {allExpanded ? (
                      <Trans i18nKey="alerting.triage.collapse-all">Collapse all</Trans>
                    ) : (
                      <Trans i18nKey="alerting.triage.expand-all">Expand all</Trans>
                    )}
                  </Button>
                  <span
                    style={{ position: 'absolute', right: `calc(100% - ${leftColumnWidth}px)`, textAlign: 'right' }}
                  >
                    <Text variant="bodySmall" color="secondary">
                      <Trans i18nKey="alerting.triage.showing-groups-count" values={{ count: data.length }}>
                        {'Showing {{count}} groups'}
                      </Trans>
                    </Text>
                  </span>
                </div>
              )}
              <div className={styles.virtualizedContainer}>
                <WorkbenchProvider
                  leftColumnWidth={leftColumnWidth}
                  rightColumnWidth={rightColumnWidth}
                  domain={domain}
                  queryRunner={queryRunner}
                  expandGeneration={expandGeneration}
                  collapseGeneration={collapseGeneration}
                >
                  <ScrollContainer height="100%" width="100%" scrollbarWidth="none" showScrollIndicators={showData}>
                    {isRefreshing && (
                      <div className={styles.loadingBarContainer}>
                        <LoadingBar width={leftColumnWidth + rightColumnWidth} />
                      </div>
                    )}
                    {isInitialLoading && (
                      <>
                        <GenericRowSkeleton key="skeleton-1" width={leftColumnWidth} depth={0} />
                        <GenericRowSkeleton key="skeleton-2" width={leftColumnWidth} depth={0} />
                        <GenericRowSkeleton key="skeleton-3" width={leftColumnWidth} depth={0} />
                      </>
                    )}
                    {showData &&
                      dataSlice.map((row, index) => {
                        const rowKey = generateRowKey(row, index);
                        return renderWorkbenchRow(row, leftColumnWidth, domain, rowKey, enableFolderMeta);
                      })}
                    {hasMore && <LoadMoreHelper handleLoad={() => setPageIndex((prevIndex) => prevIndex + 1)} />}
                  </ScrollContainer>
                </WorkbenchProvider>
              </div>
            </>
          )}
        </div>
      </div>
    </Stack>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    groupsContainer: css({
      position: 'absolute',
      width: '100%',
      height: '100%',

      display: 'flex',
      flexDirection: 'column',
    }),
    groupItemWrapper: (width: number) =>
      css({
        display: 'grid',
        gridTemplateColumns: `${width}px auto`,
        gap: theme.spacing(2),
      }),
    virtualizedContainer: css({
      display: 'flex',
      flex: 1,
      wordBreak: 'break-all', // make very long rule names render higher rows
      overflow: 'hidden', // Let AutoSizer handle the overflow
    }),
    summaryContainer: css({
      height: theme.spacing(20),
      marginBottom: theme.spacing(2),
      alignItems: 'stretch',
    }),
    loadingBarContainer: css({
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }),
    headerContainer: css({}),
    expandCollapseToolbar: css({
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      marginBottom: theme.spacing(1),
    }),
    flexFull: css({
      flex: 1,
    }),
    minColumnWidth: css({
      minWidth: 300,
    }),
  };
};
