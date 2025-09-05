import { css, cx } from '@emotion/css';
import { take } from 'lodash';
import { useState } from 'react';
import { useMeasure } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ScrollContainer, useSplitter, useStyles2 } from '@grafana/ui';
import { DEFAULT_PER_PAGE_PAGINATION } from 'app/core/constants';

import { EditorColumnHeader } from '../components/contact-points/templates/EditorColumnHeader';
import LoadMoreHelper from '../rule-list/LoadMoreHelper';

import { TimelineHeader } from './Timeline';
import { WorkbenchProvider } from './WorkbenchContext';
import { AlertRuleRow } from './rows/AlertRuleRow';
import { GroupRow } from './rows/GroupRow';
import { generateRowKey, isAlertRuleRow } from './rows/utils';
import { SummaryChartReact } from './scene/SummaryChart';
import { SummaryStatsReact } from './scene/SummaryStats';
import { Domain, Filter, WorkbenchRow } from './types';

type WorkbenchProps = {
  domain: Domain;
  data: WorkbenchRow[];
  groupBy?: string[]; // @TODO proper type
  filterBy?: Filter[];
};

const initialSize = 1 / 3;

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
export function Workbench({ domain, data }: WorkbenchProps) {
  const styles = useStyles2(getStyles);

  const [pageIndex, setPageIndex] = useState<number>(1);
  // splitter for template and payload editor
  const splitter = useSplitter({
    direction: 'row',
    // if Grafana Alertmanager, split 50/50, otherwise 100/0 because there is no payload editor
    initialSize: initialSize,
    dragPosition: 'middle',
  });

  // this will measure the size of the left most column of the splitter, so we can use it to set the width of the group items
  const [ref, rect] = useMeasure<HTMLDivElement>();
  const leftColumnWidth = rect.width;

  const itemsToRender = pageIndex * DEFAULT_PER_PAGE_PAGINATION;
  const dataSlice = take(data, itemsToRender);
  const hasMore = data.length > itemsToRender;

  return (
    <div style={{ position: 'relative', display: 'flex', flexGrow: 1, width: '100%', height: '100%' }}>
      {/* dummy splitter to handle flex width of group items */}
      <div {...splitter.containerProps}>
        <div {...splitter.primaryProps}>
          <div ref={ref} className={cx(styles.flexFull, styles.minColumnWidth)} />
        </div>
        <div {...splitter.splitterProps} />
        <div {...splitter.secondaryProps}>
          <div className={cx(styles.flexFull, styles.minColumnWidth)} />
        </div>
      </div>
      {/* content goes here */}
      <div data-testid="groups-container" className={cx(splitter.containerProps.className, styles.groupsContainer)}>
        <div className={cx(styles.groupItemWrapper(leftColumnWidth), styles.summaryContainer)}>
          <SummaryStatsReact />
          <SummaryChartReact />
        </div>
        <div className={cx(styles.groupItemWrapper(leftColumnWidth), styles.stickyHeader, styles.headerContainer)}>
          <EditorColumnHeader label={t('alerting.left-column.label-instances', 'Instances')} />
          <EditorColumnHeader>
            <TimelineHeader domain={domain} />
          </EditorColumnHeader>
        </div>
        {/* Render actual data */}
        <div className={styles.virtualizedContainer}>
          <WorkbenchProvider leftColumnWidth={leftColumnWidth} domain={domain}>
            <ScrollContainer height="100%" width="100%" scrollbarWidth="none" showScrollIndicators>
              {dataSlice.map((row, index) => {
                const rowKey = generateRowKey(row, index);

                if (isAlertRuleRow(row)) {
                  return <AlertRuleRow key={rowKey} row={row} leftColumnWidth={leftColumnWidth} rowKey={rowKey} />;
                } else {
                  return (
                    <GroupRow
                      key={rowKey}
                      row={row}
                      leftColumnWidth={leftColumnWidth}
                      domain={domain}
                      rowKey={rowKey}
                    />
                  );
                }
              })}
              {hasMore && <LoadMoreHelper handleLoad={() => setPageIndex((prevIndex) => prevIndex + 1)} />}
            </ScrollContainer>
          </WorkbenchProvider>
        </div>
      </div>
    </div>
  );
}

export const getStyles = (theme: GrafanaTheme2) => {
  const summaryHeight = 200;
  return {
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 1,
    }),
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
      overflow: 'hidden', // Let AutoSizer handle the overflow
    }),
    summaryContainer: css({
      gridTemplateRows: summaryHeight,
      marginBottom: theme.spacing(2),
    }),
    headerContainer: css({
      top: summaryHeight,
    }),
    flexFull: css({
      flex: 1,
    }),
    minColumnWidth: css({
      minWidth: 300,
    }),
  };
};
