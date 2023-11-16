import { css } from '@emotion/css';
import React, { useEffect, useState } from 'react';

import { GrafanaTheme2, LinkModel, TimeZone, TraceLog } from '@grafana/data';
import { Tab, TabContent, TabsBar, useStyles2 } from '@grafana/ui';

import { DetailState, TraceSpan } from '..';
import { SpanLinkFunc } from '../types/links';

import { DetailPanel } from './DetailPanel';

type Props = {
  spans: TraceSpan[];
  timeZone: TimeZone;
  clearSelectedSpan: (spanID: string) => void;
  detailStates: Map<string, DetailState> | undefined;
  traceStartTime: number;
  detailLogItemToggle: (spanID: string, log: TraceLog) => void;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  createSpanLink?: SpanLinkFunc;
  datasourceType: string;
  scrollToSpan: (spanID: string) => void;
};

export function DetailsPanel(props: Props) {
  const {
    spans,
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
  const [activeTab, setActiveTab] = useState<string>();
  const styles = useStyles2(getStyles);

  useEffect(() => {
    if (!activeTab) {
      setActiveTab(getKey(spans[0].spanID, 0));
    }

    // if we unpin the active tab, we need to set a new active tab
    if (
      activeTab &&
      spans.length > 0 &&
      !spans.find((span: TraceSpan, index: number) => `${span.spanID}--${index}` === activeTab)
    ) {
      setActiveTab(getKey(spans[0].spanID, 0));
    }
  }, [activeTab, spans]);

  if (spans.length === 0 || !detailStates) {
    return null;
  }

  const getKey = (spanID: string, index: number) => {
    return `${spanID}--${index}`;
  };

  return (
    <div className={styles.container}>
      <TabsBar>
        {spans.map((span: TraceSpan, index: number) => {
          const key = getKey(span.spanID, index);
          return (
            <Tab
              key={key}
              label={span.operationName}
              active={activeTab === key}
              onChangeTab={() => setActiveTab(key)}
            />
          );
        })}
      </TabsBar>

      <TabContent>
        <DetailPanel
          span={spans.find((span: TraceSpan, index: number) => {
            return getKey(span.spanID, index) === activeTab;
          })}
          timeZone={timeZone}
          clearSelectedSpan={clearSelectedSpan}
          detailStates={detailStates}
          traceStartTime={traceStartTime}
          detailLogItemToggle={detailLogItemToggle}
          createFocusSpanLink={createFocusSpanLink}
          createSpanLink={createSpanLink}
          datasourceType={datasourceType}
          scrollToSpan={scrollToSpan}
        />
      </TabContent>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'DetailsPanel',
    background: theme.colors.background.primary,
  }),
});
