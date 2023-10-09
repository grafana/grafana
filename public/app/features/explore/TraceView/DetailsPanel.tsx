import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, TimeZone, TraceLog } from '@grafana/data';
import { Button, CustomScrollbar, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { ExploreDrawer } from '../ExploreDrawer';

import { autoColor, DetailState, TraceSpan } from './components';
import { getAbsoluteTime } from './components/TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from './components/TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import AccordianLogs from './components/TraceTimelineViewer/SpanDetail/AccordianLogs';
import LabeledList from './components/common/LabeledList';
import { ubM0, ubTxRightAlign } from './components/uberUtilityStyles';
import { formatDuration } from './components/utils/date';

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  width: number;
  clearSelectedSpan: () => void;
  detailState: DetailState | undefined;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  setDetailsPanelOffset: (offset: number) => void;
};

enum TabLabels {
  Attributes = 'Attributes',
  Events = 'Events',
  Warnings = 'Warnings',
  StackTraces = 'Stack Traces',
  References = 'References',
}

export function DetailsPanel(props: Props) {
  const {
    span,
    timeZone,
    width,
    clearSelectedSpan,
    detailState,
    traceStartTime,
    detailLogItemToggle,
    setDetailsPanelOffset,
  } = props;
  const [activeTab, setActiveTab] = useState(TabLabels.Attributes);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setActiveTab(TabLabels.Attributes);
  }, [span]);

  if (!span || !detailState) {
    return null;
  }

  const { operationName, process, duration, relativeStartTime, startTime, tags, logs } = span;
  const { logs: logsState } = detailState;

  const tabs = [TabLabels.Attributes];
  if (logs && logs.length > 0) {
    tabs.push(TabLabels.Events);
  }
  const tabsCounters: Record<string, number> = {};
  tabsCounters[TabLabels.Events] = logs.length;

  const overviewItems = [
    {
      key: 'svc',
      label: 'Service:',
      value: process.serviceName,
    },
    {
      key: 'duration',
      label: 'Duration:',
      value: formatDuration(duration),
    },
    {
      key: 'start',
      label: 'Start Time:',
      value: formatDuration(relativeStartTime) + getAbsoluteTime(startTime, timeZone),
    },
    ...(span.childSpanCount > 0
      ? [
          {
            key: 'child_count',
            label: 'Child Count:',
            value: span.childSpanCount,
          },
        ]
      : []),
  ];

  const linksGetter = () => [];

  const onDrawerResize = (e: MouseEvent | TouchEvent) => {
    setDetailsPanelOffset(window.innerHeight - (e as unknown as MouseEvent).pageY);
  };

  return (
    <ExploreDrawer width={width} onResize={onDrawerResize}>
      <div className={cx(styles.header, styles.flexSpaceBetween)}>
        <div
          className={cx(
            styles.flexSpaceBetween,
            css`
              flex: 1 0 auto;
            `
          )}
        >
          <h4 className={cx(ubM0)}>{operationName}</h4>
          <div className={styles.listWrapper}>
            <LabeledList className={ubTxRightAlign} divider={true} items={overviewItems} />
          </div>
        </div>
        <Button icon={'times'} variant={'secondary'} fill={'outline'} onClick={clearSelectedSpan} size={'sm'} />
      </div>

      <TabsBar>
        {tabs.map((tab) => {
          return (
            <Tab
              key={tab}
              label={tab}
              active={activeTab === tab}
              counter={tabsCounters[tab]}
              onChangeTab={() => setActiveTab(tab)}
            />
          );
        })}
      </TabsBar>

      <CustomScrollbar>
        <TabContent className={styles.tabContent}>
          {activeTab === TabLabels.Attributes && (
            <div style={{ display: 'flex', gap: '0 1rem' }}>
              <div className={styles.attributesCol}>
                <AccordianKeyValues
                  className={styles.attributeValues}
                  data={tags}
                  label="Span Attributes"
                  linksGetter={linksGetter}
                  isOpen={true}
                  onToggle={() => {}}
                  interactive={false}
                />
              </div>
              <div className={styles.attributesCol}>
                {process.tags && (
                  <AccordianKeyValues
                    className={styles.attributeValues}
                    data={process.tags}
                    label="Resource Attributes"
                    linksGetter={linksGetter}
                    isOpen={true}
                    interactive={false}
                    onToggle={() => {}}
                  />
                )}
              </div>
            </div>
          )}
          {activeTab === TabLabels.Events && logs && logs.length > 0 && (
            <AccordianLogs
              linksGetter={linksGetter}
              logs={logs}
              isOpen={true}
              openedItems={logsState.openedItems}
              onItemToggle={(logItem) => detailLogItemToggle(span.spanID, logItem)}
              timestamp={traceStartTime}
            />
          )}
          {/* {tabsState[2] && tabsState[2].active && <div>Warnings not yet implemented</div>}
          {tabsState[3] && tabsState[3].active && <div>Stack Traces not yet implemented</div>}
          {tabsState[4] && tabsState[4].active && <div>References not yet implemented</div>} */}
        </TabContent>
      </CustomScrollbar>
    </ExploreDrawer>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  header: css`
    gap: 0 1rem;
    margin-bottom: 0.25rem;
    padding: 0.6rem;
    overflow: scroll;
  `,
  flexSpaceBetween: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  attributesCol: css`
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    flex: 0 50%;
  `,
  listWrapper: css`
    overflow: hidden;
  `,
  attributeValues: css`
    display: flex;
    flex-direction: column;
    flex: 1 0 auto;
  `,
  tabContent: css`
    padding: 0.5rem 1rem 90px 1rem;

    & .json-markup {
      line-height: 17px;
      font-size: 13px;
      font-family: monospace;
      white-space: pre-wrap;
    }

    & .json-markup-key {
      font-weight: bold;
    }

    & .json-markup-bool {
      color: ${autoColor(theme, 'firebrick')};
    }

    & .json-markup-string {
      color: ${autoColor(theme, 'teal')};
    }

    & .json-markup-null {
      color: ${autoColor(theme, 'teal')};
    }

    & .json-markup-number {
      color: ${autoColor(theme, 'blue', 'black')};
    }
  `,
});
