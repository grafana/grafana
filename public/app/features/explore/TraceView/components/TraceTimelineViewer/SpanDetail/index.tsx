// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { css } from '@emotion/css';
import { SpanStatusCode } from '@opentelemetry/api';
import { useCallback, useMemo } from 'react';

import {
  CoreApp,
  DataFrame,
  dateTimeFormat,
  GrafanaTheme2,
  LinkModel,
  TimeRange,
  TraceKeyValuePair,
  TraceLog,
  PluginExtensionResourceAttributesContext,
  PluginExtensionPoints,
  IconName,
} from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { usePluginLinks } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { TextArea, useStyles2 } from '@grafana/ui';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { autoColor } from '../../Theme';
import LabeledList from '../../common/LabeledList';
import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE } from '../../constants/span';
import { SpanLinkFunc } from '../../types/links';
import { TraceProcess, TraceSpan, TraceSpanReference } from '../../types/trace';
import { formatDuration } from '../utils';

import AccordianKeyValues from './AccordianKeyValues';
import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import AccordianText from './AccordianText';
import DetailState from './DetailState';
import { ShareSpanButton } from './ShareSpanButton';
import { getSpanDetailLinkButtons } from './SpanDetailLinkButtons';
import SpanFlameGraph from './SpanFlameGraph';

const useResourceAttributesExtensionLinks = (process: TraceProcess, datasourceType: string, datasourceUid: string) => {
  // Stable context for useMemo inside usePluginLinks
  const context: PluginExtensionResourceAttributesContext = useMemo(() => {
    const attributes = (process.tags ?? []).reduce<Record<string, string[]>>((acc, tag) => {
      if (acc[tag.key]) {
        acc[tag.key].push(tag.value);
      } else {
        acc[tag.key] = [tag.value];
      }
      return acc;
    }, {});

    return {
      attributes,
      datasource: {
        type: datasourceType,
        uid: datasourceUid,
      },
    };
  }, [process.tags, datasourceType, datasourceUid]);

  const { links } = usePluginLinks({
    extensionPointId: PluginExtensionPoints.TraceViewResourceAttributes,
    limitPerPlugin: 10,
    context,
  });

  const resourceLinksGetter = useCallback(
    (pairs: TraceKeyValuePair[], index: number) => {
      const { key } = pairs[index] ?? {};
      return links.filter((link) => link.category === key);
    },
    [links]
  );

  return resourceLinksGetter;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css({
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '0 1rem',
      marginBottom: '0.25rem',
    }),
    listWrapper: css({
      overflow: 'hidden',
      flexGrow: 1,
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    list: css({
      textAlign: 'left',
    }),
    operationName: css({
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      maxWidth: '50%',
      flexGrow: 0,
      flexShrink: 0,
    }),
    AccordianWarnings: css({
      label: 'AccordianWarnings',
      background: autoColor(theme, '#fafafa'),
      border: `1px solid ${autoColor(theme, '#e4e4e4')}`,
      marginBottom: '0.25rem',
    }),
    AccordianWarningsHeader: css({
      label: 'AccordianWarningsHeader',
      background: autoColor(theme, '#fff7e6'),
      padding: '0.25rem 0.5rem',
      '&:hover': {
        background: autoColor(theme, '#ffe7ba'),
      },
    }),
    AccordianWarningsHeaderOpen: css({
      label: 'AccordianWarningsHeaderOpen',
      borderBottom: `1px solid ${autoColor(theme, '#e8e8e8')}`,
    }),
    AccordianWarningsLabel: css({
      label: 'AccordianWarningsLabel',
      color: autoColor(theme, '#d36c08'),
    }),
    Textarea: css({
      wordBreak: 'break-all',
      whiteSpace: 'pre',
    }),
    linkList: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
      marginBottom: theme.spacing(2),
    }),
  };
};

export const alignIcon = css({
  margin: '-0.2rem 0.25rem 0 0',
});

export type TraceFlameGraphs = {
  [spanID: string]: DataFrame;
};

export type SpanDetailProps = {
  color: string;
  detailState: DetailState;
  logItemToggle: (spanID: string, log: TraceLog) => void;
  logsToggle: (spanID: string) => void;
  processToggle: (spanID: string) => void;
  span: TraceSpan;
  traceToProfilesOptions?: TraceToProfilesOptions;
  timeZone: TimeZone;
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  traceDuration: number;
  traceName: string;
  warningsToggle: (spanID: string) => void;
  stackTracesToggle: (spanID: string) => void;
  referenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  referencesToggle: (spanID: string) => void;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  datasourceType: string;
  datasourceUid: string;
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
  timeRange: TimeRange;
  app: CoreApp;
};

export default function SpanDetail(props: SpanDetailProps) {
  const {
    color,
    detailState,
    logItemToggle,
    logsToggle,
    processToggle,
    span,
    tagsToggle,
    traceStartTime,
    traceDuration,
    traceName,
    warningsToggle,
    stackTracesToggle,
    referencesToggle,
    referenceItemToggle,
    createSpanLink,
    createFocusSpanLink,
    datasourceType,
    datasourceUid,
    traceFlameGraphs,
    setTraceFlameGraphs,
    traceToProfilesOptions,
    setRedrawListView,
    timeRange,
    app,
  } = props;
  const {
    isTagsOpen,
    isProcessOpen,
    logs: logsState,
    isWarningsOpen,
    references: referencesState,
    isStackTracesOpen,
  } = detailState;
  const {
    operationName,
    process,
    duration,
    relativeStartTime,
    startTime,
    traceID,
    spanID,
    logs,
    tags,
    warnings,
    references,
    stackTraces,
  } = span;

  const { timeZone } = props;
  const durationIcon: IconName = 'hourglass';
  const startIcon: IconName = 'clock-nine';

  let overviewItems = [
    {
      key: 'svc',
      label: t('explore.span-detail.overview-items.label.service', 'Service:'),
      value: process.serviceName,
    },
    {
      key: 'duration',
      label: t('explore.span-detail.overview-items.label.duration', 'Duration:'),
      value: formatDuration(duration),
      icon: durationIcon,
    },
    {
      key: 'start',
      label: t('explore.span-detail.overview-items.label.start-time', 'Start Time:'),
      value: formatDuration(relativeStartTime) + getAbsoluteTime(startTime, timeZone),
      icon: startIcon,
    },
    ...(span.childSpanCount > 0
      ? [
          {
            key: 'child_count',
            label: t('explore.span-detail.overview-items.label.child-count', 'Child Count:'),
            value: span.childSpanCount,
          },
        ]
      : []),
  ];

  const styles = useStyles2(getStyles);
  if (span.kind) {
    overviewItems.push({
      key: KIND,
      label: t('explore.span-detail.label.kind', 'Kind:'),
      value: span.kind,
    });
  }
  if (span.statusCode !== undefined) {
    overviewItems.push({
      key: STATUS,
      label: t('explore.span-detail.label.status', 'Status:'),
      value: SpanStatusCode[span.statusCode].toLowerCase(),
    });
  }
  if (span.statusMessage) {
    overviewItems.push({
      key: STATUS_MESSAGE,
      label: t('explore.span-detail.label.status-message', 'Status Message:'),
      value: span.statusMessage,
    });
  }
  if (span.instrumentationLibraryName) {
    overviewItems.push({
      key: LIBRARY_NAME,
      label: t('explore.span-detail.label.library-name', 'Library Name:'),
      value: span.instrumentationLibraryName,
    });
  }
  if (span.instrumentationLibraryVersion) {
    overviewItems.push({
      key: LIBRARY_VERSION,
      label: t('explore.span-detail.label.library-version', 'Library Version:'),
      value: span.instrumentationLibraryVersion,
    });
  }
  if (span.traceState) {
    overviewItems.push({
      key: TRACE_STATE,
      label: t('explore.span-detail.label.trace-state', 'Trace State:'),
      value: span.traceState,
    });
  }

  const linksComponent = getSpanDetailLinkButtons({
    span,
    createSpanLink,
    datasourceType,
    traceToProfilesOptions,
    timeRange,
    app,
  });

  const focusSpanLink = createFocusSpanLink(traceID, spanID);
  const resourceLinksGetter = useResourceAttributesExtensionLinks(process, datasourceType, datasourceUid);

  return (
    <div data-testid="span-detail-component">
      <div className={styles.header}>
        <h6 className={styles.operationName} title={operationName}>
          {operationName}
        </h6>
        <div className={styles.listWrapper}>
          <LabeledList className={styles.list} divider={false} items={overviewItems} color={color} />
        </div>
        <ShareSpanButton focusSpanLink={focusSpanLink} />
      </div>
      <div className={styles.linkList}>{linksComponent}</div>
      <div>
        <div>
          <AccordianKeyValues
            data={tags}
            label={t('explore.span-detail.label-span-attributes', 'Span attributes')}
            isOpen={isTagsOpen}
            onToggle={() => tagsToggle(spanID)}
          />
          {process.tags && (
            <AccordianKeyValues
              data={process.tags}
              label={t('explore.span-detail.label-resource-attributes', 'Resource attributes')}
              linksGetter={resourceLinksGetter}
              isOpen={isProcessOpen}
              onToggle={() => processToggle(spanID)}
            />
          )}
        </div>
        {logs && logs.length > 0 && (
          <AccordianLogs
            logs={logs}
            isOpen={logsState.isOpen}
            openedItems={logsState.openedItems}
            onToggle={() => logsToggle(spanID)}
            onItemToggle={(logItem) => logItemToggle(spanID, logItem)}
            timestamp={traceStartTime}
          />
        )}
        {warnings && warnings.length > 0 && (
          <AccordianText
            className={styles.AccordianWarnings}
            headerClassName={styles.AccordianWarningsHeader}
            label={
              <span className={styles.AccordianWarningsLabel}>
                <Trans i18nKey="explore.span-detail.warnings">Warnings</Trans>
              </span>
            }
            data={warnings}
            isOpen={isWarningsOpen}
            onToggle={() => warningsToggle(spanID)}
          />
        )}
        {stackTraces?.length ? (
          <AccordianText
            label={t('explore.span-detail.label-stack-trace', 'Stack trace')}
            data={stackTraces}
            isOpen={isStackTracesOpen}
            TextComponent={(textComponentProps) => {
              let text;
              if (textComponentProps.data?.length > 1) {
                text = textComponentProps.data
                  .map((stackTrace, index) => `StackTrace ${index + 1}:\n${stackTrace}`)
                  .join('\n');
              } else {
                text = textComponentProps.data?.[0];
              }
              return (
                <TextArea
                  className={styles.Textarea}
                  style={{ cursor: 'unset' }}
                  readOnly
                  cols={10}
                  rows={10}
                  value={text}
                />
              );
            }}
            onToggle={() => stackTracesToggle(spanID)}
          />
        ) : null}
        {references && references.length > 0 && (references.length > 1 || references[0].refType !== 'CHILD_OF') && (
          <AccordianReferences
            data={references}
            isOpen={referencesState.isOpen}
            openedItems={referencesState.openedItems}
            onToggle={() => referencesToggle(spanID)}
            onItemToggle={(reference) => referenceItemToggle(spanID, reference)}
            createFocusSpanLink={createFocusSpanLink}
          />
        )}
        {span.tags.some((tag) => tag.key === pyroscopeProfileIdTagKey) && (
          <SpanFlameGraph
            span={span}
            timeZone={timeZone}
            traceFlameGraphs={traceFlameGraphs}
            setTraceFlameGraphs={setTraceFlameGraphs}
            traceToProfilesOptions={traceToProfilesOptions}
            setRedrawListView={setRedrawListView}
            traceDuration={traceDuration}
            traceName={traceName}
          />
        )}
      </div>
    </div>
  );
}

export const getAbsoluteTime = (startTime: number, timeZone: TimeZone) => {
  const dateStr = dateTimeFormat(startTime / 1000, { timeZone, defaultWithMS: true });
  const match = dateStr.split(' ');
  const absoluteTime = match[1] ? match[1] : dateStr;
  return ` (${absoluteTime})`;
};
