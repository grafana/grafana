import { css, cx } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2, TimeZone } from '@grafana/data';
import { Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { ExploreDrawer } from '../ExploreDrawer';

import { TraceSpan } from './components';
import { getAbsoluteTime } from './components/TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from './components/TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import LabeledList from './components/common/LabeledList';
import { ubM0, ubTxRightAlign } from './components/uberUtilityStyles';
import { formatDuration } from './components/utils/date';

const getStyles = (theme: GrafanaTheme2) => ({
  header: css`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0 1rem;
    margin-bottom: 0.25rem;
    padding: 0.5rem;
  `,
  container: css`
    height: 300px;
    width: 100%;
    position: sticky;
    bottom: 0;
    background: ${theme.colors.background.primary};
    z-index: 2;
    border-top: 1px solid ${theme.colors.border.strong};
  `,
  attributesCol: css`
    display: flex;
    flex: 1 0 auto;
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
    padding: 0.25rem 0.5rem;
  `,
});

const tabs = [
  { label: 'Attributes', key: 'attributes', active: true },
  { label: 'Events', key: 'events', active: false },
  { label: 'Logs', key: 'logs', active: false },
  { label: 'Warnings', key: 'warnings', active: false },
  { label: 'Stack Traces', key: 'stackTraces', active: false },
  { label: 'References', key: 'references', active: false },
];

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  width: number;
};

export function DetailsPanel(props: Props) {
  const [tabsState, updateTabsState] = useState(tabs);
  const styles = useStyles2(getStyles);
  const { span, timeZone, width } = props;

  if (!span) {
    return null;
  }

  const { operationName, process, duration, relativeStartTime, startTime, tags } = span;

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

  const tabsCounters: Record<string, number> = {};
  tabsCounters['events'] = span.logs.length;

  const linksGetter = () => [];

  return (
    <ExploreDrawer width={width}>
      <div className={styles.header}>
        <h4 className={cx(ubM0)}>{operationName}</h4>
        <div className={styles.listWrapper}>
          <LabeledList className={ubTxRightAlign} divider={true} items={overviewItems} />
        </div>
      </div>
      <TabsBar>
        {tabsState.map((tab, index) => {
          return (
            <Tab
              key={tab.key}
              label={tab.label}
              active={tab.active}
              counter={tabsCounters[tab.key]}
              onChangeTab={() => updateTabsState(tabsState.map((tab, idx) => ({ ...tab, active: idx === index })))}
            />
          );
        })}
      </TabsBar>
      <TabContent className={styles.tabContent}>
        {tabsState[0].active && (
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
        {tabsState[1].active && <div>Events not yet implemented</div>}
        {tabsState[2].active && <div>Logs not yet implemented</div>}
        {tabsState[3].active && <div>Warnings not yet implemented</div>}
        {tabsState[4].active && <div>Stack Traces not yet implemented</div>}
        {tabsState[5].active && <div>References not yet implemented</div>}
      </TabContent>
    </ExploreDrawer>
  );
}
