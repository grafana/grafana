import { css, cx } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, LinkModel, TimeZone, TraceLog } from '@grafana/data';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Button, DataLinkButton, Icon, Tab, TabContent, TabsBar, useStyles2, useTheme2 } from '@grafana/ui';

import { autoColor, DetailState, TraceSpan } from '..';
import { getOverviewItems } from '../TraceTimelineViewer/SpanDetail';
import AccordianKeyValues from '../TraceTimelineViewer/SpanDetail/AccordianKeyValues';
import TextList from '../TraceTimelineViewer/SpanDetail/TextList';
import { TopOfViewRefType } from '../TraceTimelineViewer/VirtualizedTraceView';
import LabeledList from '../common/LabeledList';
import { SpanLinkFunc, SpanLinkType } from '../types/links';
import { TraceSpanReference } from '../types/trace';
import { uAlignIcon, ubTxRightAlign } from '../uberUtilityStyles';

import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import { DetailsDrawer } from './DetailsDrawer';
import { StackTraces } from './StackTraces';

type Props = {
  span?: TraceSpan;
  timeZone: TimeZone;
  width: number;
  clearSelectedSpan: () => void;
  detailState: DetailState | undefined;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  detailReferenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  createSpanLink?: SpanLinkFunc;
  datasourceType: string;
  topOfViewRefType?: TopOfViewRefType;
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
    detailReferenceItemToggle,
    createFocusSpanLink,
    createSpanLink,
    datasourceType,
    topOfViewRefType,
  } = props;
  const [activeTab, setActiveTab] = useState(TabLabels.Attributes);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  useEffect(() => {
    setActiveTab(TabLabels.Attributes);
  }, [span]);

  if (!span || !detailState) {
    return null;
  }

  let { operationName, process, tags, logs, warnings, stackTraces, references } = span;
  const { logs: logsState, references: referencesState } = detailState;

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
  if (references && references.length > 0) {
    tabs.push(TabLabels.References);
    tabsCounters[TabLabels.References] = references.length;
  }

  const focusSpanLink = createFocusSpanLink(span.traceID, span.spanID);
  let logLinkButton: JSX.Element | undefined = undefined;
  if (createSpanLink) {
    const links = createSpanLink(span);
    const logLinks = links?.filter((link) => link.type === SpanLinkType.Logs);
    if (links && logLinks && logLinks.length > 0) {
      logLinkButton = (
        <DataLinkButton
          link={{
            ...logLinks[0],
            title: 'Logs for this span',
            target: '_blank',
            origin: logLinks[0].field,
            onClick: (event: React.MouseEvent) => {
              // DataLinkButton assumes if you provide an onClick event you would want to prevent default behavior like navigation
              // In this case, if an onClick is not defined, restore navigation to the provided href while keeping the tracking
              // this interaction will not be tracked with link right clicks
              reportInteraction('grafana_traces_trace_view_span_link_clicked', {
                datasourceType: datasourceType,
                grafana_version: config.buildInfo.version,
                type: 'log',
                location: 'detailsPanel',
              });

              if (logLinks?.[0].onClick) {
                logLinks?.[0].onClick?.(event);
              } else {
                locationService.push(logLinks?.[0].href);
              }
            },
          }}
          buttonProps={{ icon: 'gf-logs' }}
        />
      );
    }
  }

  const linksGetter = () => [];
  const attrsTabStyle = window.innerWidth > 800 ? { display: 'flex', gap: '0 1rem' } : { display: 'block' };

  return (
    <div className={styles.container}>
      {/* The first child here needs to be the DetailsDrawer to we can get it's height via onDrawerResize. This is so we can set a paddingBottom in the TraceView according to this components height */}
      <DetailsDrawer
        width={width}
        defaultHeight={
          theme.components.horizontalDrawer.defaultHeight - (topOfViewRefType === TopOfViewRefType.Explore ? 80 : 165)
        }
        minHeight={topOfViewRefType === TopOfViewRefType.Explore ? 200 : 150}
      >
        <div className={cx(styles.header, styles.flexSpaceBetween)}>
          <div className={cx(styles.flexSpaceBetween, css({ flex: '1 0 auto' }))}>
            <h4 style={{ margin: 0 }}>{operationName}</h4>
            <LabeledList className={ubTxRightAlign} divider={true} items={getOverviewItems(span, timeZone)} />
          </div>
          <Button icon={'times'} variant={'secondary'} onClick={clearSelectedSpan} size={'sm'} />
        </div>

        <div className={styles.linkContainer}>
          {logLinkButton}

          {topOfViewRefType === TopOfViewRefType.Explore && (
            <small className={styles.debugInfo}>
              {/* TODO: fix keyboard a11y */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
              <a
                {...focusSpanLink}
                onClick={(e) => {
                  // click handling logic copied from react router:
                  // https://github.com/remix-run/react-router/blob/997b4d67e506d39ac6571cb369d6d2d6b3dda557/packages/react-router-dom/index.tsx#L392-L394s
                  if (
                    focusSpanLink.onClick &&
                    e.button === 0 && // Ignore everything but left clicks
                    (!e.currentTarget.target || e.currentTarget.target === '_self') && // Let browser handle "target=_blank" etc.
                    !(e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) // Ignore clicks with modifier keys
                  ) {
                    e.preventDefault();
                    focusSpanLink.onClick(e);
                  }
                }}
              >
                <Icon name={'link'} className={cx(uAlignIcon, styles.linkIcon)}></Icon>
              </a>
              SpanID: {span.spanID}
            </small>
          )}
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
            <div style={attrsTabStyle}>
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
          {activeTab === TabLabels.Events && logs && logs.length > 0 && (
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
            <AccordianReferences
              data={references}
              openedItems={referencesState.openedItems}
              onItemToggle={(reference) => detailReferenceItemToggle(span.spanID, reference)}
              createFocusSpanLink={createFocusSpanLink}
            />
          )}
        </TabContent>
      </DetailsDrawer>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'DetailsPanel',
    overflow: 'scroll',
    position: 'sticky',
    bottom: 0,
    zIndex: `${theme.zIndex.activePanel}`,
  }),
  header: css({
    gap: '0 1rem',
    padding: '0.6rem',
    overflow: 'scroll',
  }),
  flexSpaceBetween: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  tab: css({
    label: 'DetailsPanelTab',
    padding: '0.5rem 1rem',
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
  attributesContainer: css({
    label: 'DetailsPanelAttrsContainer',
    display: 'flex',
    flexDirection: 'column',
    flex: '0 50%',
  }),
  attributeValues: css({
    display: 'flex',
    flexDirection: 'column',
  }),
  linkContainer: css({
    label: 'DetailsPanelLinkContainer',
    display: 'flex',
    alignItems: 'flex-end',
    flexDirection: 'row-reverse',
    paddingRight: '0.6rem',
  }),
  debugInfo: css({
    label: 'DetailsPanelDebugInfo',
    letterSpacing: '0.25px',
    marginRight: '15px',
  }),
  linkIcon: css({
    fontSize: '1.5em',
  }),
});
