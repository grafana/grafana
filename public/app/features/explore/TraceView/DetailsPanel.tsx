import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, TimeZone, TraceLog } from '@grafana/data';
import { Button, Tab, TabContent, TabsBar, TextArea, useStyles2 } from '@grafana/ui';

import { ExploreDrawer } from '../ExploreDrawer';

import { autoColor, DetailState, TraceSpan } from './components';
import { getOverviewItems } from './components/TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from './components/TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import AccordianLogs from './components/TraceTimelineViewer/SpanDetail/AccordianLogs';
import TextList from './components/TraceTimelineViewer/SpanDetail/TextList';
import LabeledList from './components/common/LabeledList';
import { ubTxRightAlign } from './components/uberUtilityStyles';

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  width: number;
  clearSelectedSpan: () => void;
  detailState: DetailState | undefined;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  setDetailsPanelOffset: (offset: number) => void;
  defaultDetailsPanelHeight: number;
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
    defaultDetailsPanelHeight,
  } = props;
  const [activeTab, setActiveTab] = useState(TabLabels.Attributes);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setActiveTab(TabLabels.Attributes);
  }, [span]);

  if (!span || !detailState) {
    return null;
  }

  let { operationName, process, tags, logs, warnings, stackTraces } = span;
  const { logs: logsState } = detailState;

  const tabs = [TabLabels.Attributes];
  const tabsCounters: Record<string, number> = {};
  warnings = ['Testing the warning', 'And here is another', 'Two more', 'Last one!'];
  stackTraces = ['Testing the stack traces', 'And here is another', 'Two more', 'Last one!'];
  if (logs && logs.length > 0) {
    tabs.push(TabLabels.Events);
    tabsCounters[TabLabels.Events] = logs.length;
  }
  if (warnings && warnings.length > 0) {
    tabs.push(TabLabels.Warnings);
    tabsCounters[TabLabels.Warnings] = warnings.length;
  }
  if (stackTraces && stackTraces.length > 0) {
    tabs.push(TabLabels.StackTraces);
    tabsCounters[TabLabels.StackTraces] = stackTraces.length;
  }

  const linksGetter = () => [];

  const onDrawerResize = () => {
    const container = document.querySelector(`.${styles.container}`)?.firstChild;
    if (container instanceof HTMLElement) {
      const height = container.style.height;
      const heightVal =
        height && typeof parseInt(height.split('px')[0], 10) === 'number' ? parseInt(height.split('px')[0], 10) : 0;
      setDetailsPanelOffset(heightVal);
    }
  };

  const StackTraces = ({ stackTraces }: { stackTraces: string[] }) => {
    let text;
    if (stackTraces?.length > 1) {
      text = stackTraces.map((stackTrace, index) => `StackTrace ${index + 1}:\n${stackTrace}`).join('\n');
    } else {
      text = stackTraces?.[0];
    }
    return (
      <TextArea className={styles.stackTraces} style={{ cursor: 'unset' }} readOnly cols={10} rows={10} value={text} />
    );
  };

  return (
    <div className={styles.container}>
      {/* The first child here needs to be the ExploreDrawer to we can get it's height via onDrawerResize. This is so we can set a paddingBottom in the TraceView according to this components height */}
      <ExploreDrawer
        width={width}
        onResize={onDrawerResize}
        defaultHeight={defaultDetailsPanelHeight}
        className={styles.drawer}
      >
        <div className={cx(styles.header, styles.flexSpaceBetween)}>
          <div
            className={cx(
              styles.flexSpaceBetween,
              css`
                flex: 1 0 auto;
              `
            )}
          >
            <h4 style={{ margin: 0 }}>{operationName}</h4>
            <LabeledList className={ubTxRightAlign} divider={true} items={getOverviewItems(span, timeZone)} />
          </div>
          <Button icon={'times'} variant={'secondary'} onClick={clearSelectedSpan} size={'sm'} />
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

        <TabContent className={styles.tab}>
          {activeTab === TabLabels.Attributes && (
            <div style={{ display: 'flex', gap: '0 1rem' }}>
              <div className={styles.attributesContainer}>
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
              <div className={styles.attributesContainer}>
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
          {activeTab === TabLabels.Warnings && <TextList data={warnings} />}
          {activeTab === TabLabels.StackTraces && <StackTraces stackTraces={stackTraces ?? []} />}
          {/*tabsState[3] && tabsState[3].active && <div>Stack Traces not yet implemented</div>}
          {tabsState[4] && tabsState[4].active && <div>References not yet implemented</div>} */}
        </TabContent>
      </ExploreDrawer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    label: DetailsPanelContainer;
    position: fixed;
    overflow: auto;
    bottom: 0;
    z-index: 9;
  `,
  drawer: css`
    margin: 0;
    position: relative !important;
  `,
  header: css`
    gap: 0 1rem;
    padding: 0.6rem;
    overflow: scroll;
  `,
  flexSpaceBetween: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  tab: css`
    label: DetailsPanelTab;
    padding: 0.5rem 1rem;

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
  attributesContainer: css`
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
    flex: 0 50%;
  `,
  attributeValues: css`
    display: flex;
    flex-direction: column;
  `,
  stackTraces: css`
    word-break: break-all;
    white-space: pre;
  `,
});
