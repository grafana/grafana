import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, LinkModel, TimeZone, TraceLog } from '@grafana/data';
import { Button, Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { autoColor, DetailState, TraceSpan } from '..';
import { getOverviewItems, getSpanLinkButtons } from '../TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from '../TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import TextList from '../TraceTimelineViewer/SpanDetail/TextList';
import LabeledList from '../common/LabeledList';
import { SpanLinkFunc } from '../types/links';
import { ubTxRightAlign } from '../uberUtilityStyles';

import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import { StackTraces } from './StackTraces';

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  clearSelectedSpan: (spanID: string) => void;
  detailStates: Map<string, DetailState>;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  createSpanLink?: SpanLinkFunc;
  datasourceType: string;
  scrollToSpan: (spanID: string) => void;
};

enum TabLabels {
  Attributes = 'Attributes',
  Events = 'Events',
  Warnings = 'Warnings',
  StackTraces = 'Stack Traces',
  References = 'References',
}

export function DetailPanel(props: Props) {
  const {
    span,
    timeZone,
    clearSelectedSpan,
    detailStates,
    traceStartTime,
    detailLogItemToggle,
    createFocusSpanLink,
    createSpanLink,
    datasourceType,
    scrollToSpan,
  } = props;
  const [activeTab, setActiveTab] = useState(TabLabels.Attributes);
  const styles = useStyles2(getStyles);

  useEffect(() => {
    setActiveTab(TabLabels.Attributes);
  }, [span]);

  const detailState = detailStates.get(span?.spanID ?? '');

  if (!span || !detailState) {
    return null;
  }

  let { operationName, process, tags, logs, warnings, stackTraces, references } = span;
  const { logs: logsState } = detailState;

  const tabs = [TabLabels.Attributes];
  const tabsCounters: Record<string, number> = {};

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
  if (references && references.length > 0 && (references.length > 1 || references[0].refType !== 'CHILD_OF')) {
    tabs.push(TabLabels.References);
    tabsCounters[TabLabels.References] = references.length;
  }

  const { logLinkButton, profileLinkButton } = getSpanLinkButtons(datasourceType, createSpanLink, span);
  const scrollToSpanButton = (
    <Button variant={'secondary'} onClick={() => scrollToSpan(span.spanID)} size={'sm'}>
      Scroll to span
    </Button>
  );
  const linksGetter = () => [];

  return (
    <div className={styles.container}>
      <div className={cx(styles.header, styles.flexSpaceBetween)}>
        <div className={cx(styles.flexSpaceBetween, css({ flex: '1 0 auto' }))}>
          <h4 style={{ margin: 0 }}>{operationName}</h4>
          <LabeledList className={ubTxRightAlign} divider={true} items={getOverviewItems(span, timeZone)} />
        </div>
        <Button icon={'times'} variant={'secondary'} onClick={() => clearSelectedSpan(span.spanID)} size={'sm'} />
      </div>

      <div className={styles.buttons}>
        {logLinkButton && logLinkButton}
        {profileLinkButton && profileLinkButton}
        {scrollToSpanButton}
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
          <div className={styles.attributes}>
            <div className={styles.attributesContainer}>
              <AccordianKeyValues
                className={styles.attributeValues}
                data={tags}
                label="Span Attributes"
                linksGetter={linksGetter}
                isOpen={true}
                interactive={false}
              />
            </div>
            <div className={styles.attributesContainer}>
              <AccordianKeyValues
                className={styles.attributeValues}
                data={process.tags}
                label="Resource Attributes"
                linksGetter={linksGetter}
                isOpen={true}
                interactive={false}
              />
            </div>
          </div>
        )}
        {activeTab === TabLabels.Events && (
          <AccordianLogs
            linksGetter={linksGetter}
            logs={logs}
            openedItems={logsState.openedItems}
            onItemToggle={(logItem) => detailLogItemToggle(span.spanID, logItem)}
            timestamp={traceStartTime}
          />
        )}
        {activeTab === TabLabels.Warnings && <TextList data={warnings} />}
        {activeTab === TabLabels.StackTraces && <StackTraces stackTraces={stackTraces ?? []} />}
        {activeTab === TabLabels.References && (
          <AccordianReferences data={references} createFocusSpanLink={createFocusSpanLink} />
        )}
      </TabContent>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'DetailPanel',
    background: theme.colors.background.primary,
  }),
  header: css({
    gap: '0 1rem',
    padding: '0.6rem',
    overflow: 'scroll',
  }),
  buttons: css({
    display: 'flex',
    alignItems: 'center',
    gap: '0 0.5rem',
    marginBottom: '0.25rem',
    marginLeft: '0.75rem',
  }),
  flexSpaceBetween: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  button: css({
    marginTop: '-10px',
  }),
  tab: css({
    label: 'DetailPanelTab',
    padding: theme.spacing(1, 1),
    '.json-markup': {
      lineHeight: '17px',
      fontSize: '13px',
      fontFamily: 'monospace',
      whiteSpace: 'pre-wrap',
    },
    '.json-markup-key': {
      fontWeight: 'bold',
    },
    '.json-markup-bool': {
      color: autoColor(theme, 'firebrick'),
    },
    '.json-markup-string': {
      color: autoColor(theme, 'teal'),
    },
    '.json-markup-null': {
      color: autoColor(theme, 'teal'),
    },
    '.json-markup-number': {
      color: autoColor(theme, 'blue', 'black'),
    },
  }),
  attributes: css({
    label: 'DetailPanelAttributes',
    display: 'flex',
    gap: '0 1rem',

    '@media(max-width: 800px)': {
      display: 'block',
    },
  }),
  attributesContainer: css({
    label: 'DetailPanelAttrsContainer',
    display: 'flex',
    flexDirection: 'column',
    flex: '0 50%',
  }),
  attributeValues: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  debugInfo: css({
    label: 'DetailPanelDebugInfo',
    letterSpacing: '0.25px',
    display: 'flex',
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
    padding: theme.spacing(1, 1),
  }),
  linkIcon: css({
    fontSize: '1.5em',
  }),
});
