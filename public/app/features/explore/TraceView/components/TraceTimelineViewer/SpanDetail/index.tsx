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
import cx from 'classnames';
import * as React from 'react';

import {
  DataFrame,
  dateTimeFormat,
  GrafanaTheme2,
  IconName,
  LinkModel,
  TraceKeyValuePair,
  TraceLog,
} from '@grafana/data';
import { TraceToProfilesOptions } from '@grafana/o11y-ds-frontend';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { DataLinkButton, Divider, Icon, TextArea, useStyles2 } from '@grafana/ui';
import { RelatedProfilesTitle } from '@grafana-plugins/tempo/resultTransformer';

import { pyroscopeProfileIdTagKey } from '../../../createSpanLink';
import { autoColor } from '../../Theme';
import LabeledList from '../../common/LabeledList';
import { KIND, LIBRARY_NAME, LIBRARY_VERSION, STATUS, STATUS_MESSAGE, TRACE_STATE } from '../../constants/span';
import { SpanLinkFunc, TNil } from '../../types';
import { SpanLinkDef, SpanLinkType } from '../../types/links';
import { TraceLink, TraceSpan, TraceSpanReference } from '../../types/trace';
import { formatDuration } from '../utils';

import AccordianKeyValues from './AccordianKeyValues';
import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import AccordianText from './AccordianText';
import DetailState from './DetailState';
import SpanFlameGraph from './SpanFlameGraph';

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
    }),
    list: css({
      textAlign: 'right',
    }),
    operationName: css({
      margin: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      flexBasis: '50%',
      flexGrow: 0,
      flexShrink: 0,
    }),
    debugInfo: css({
      label: 'debugInfo',
      display: 'block',
      letterSpacing: '0.25px',
      margin: '0.5em 0 -0.75em',
      textAlign: 'right',
    }),
    debugLabel: css({
      label: 'debugLabel',
      '&::before': {
        color: autoColor(theme, '#bbb'),
        content: 'attr(data-label)',
      },
    }),
    debugValue: css({
      label: 'debugValue',
      backgroundColor: 'inherit',
      border: 'none',
      color: autoColor(theme, '#888'),
      cursor: 'pointer',
      '&:hover': {
        color: autoColor(theme, '#333'),
      },
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
    AccordianKeyValuesItem: css({
      marginBottom: theme.spacing(0.5),
    }),
    Textarea: css({
      wordBreak: 'break-all',
      whiteSpace: 'pre',
    }),
    LinkIcon: css({
      fontSize: '1.5em',
    }),
    linkList: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: '10px',
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
  detailState: DetailState;
  linksGetter: ((links: TraceKeyValuePair[], index: number) => TraceLink[]) | TNil;
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
  traceFlameGraphs: TraceFlameGraphs;
  setTraceFlameGraphs: (flameGraphs: TraceFlameGraphs) => void;
  setRedrawListView: (redraw: {}) => void;
};

export default function SpanDetail(props: SpanDetailProps) {
  const {
    detailState,
    linksGetter,
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
    traceFlameGraphs,
    setTraceFlameGraphs,
    traceToProfilesOptions,
    setRedrawListView,
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
  let overviewItems = [
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

  const styles = useStyles2(getStyles);

  if (span.kind) {
    overviewItems.push({
      key: KIND,
      label: 'Kind:',
      value: span.kind,
    });
  }
  if (span.statusCode !== undefined) {
    overviewItems.push({
      key: STATUS,
      label: 'Status:',
      value: SpanStatusCode[span.statusCode].toLowerCase(),
    });
  }
  if (span.statusMessage) {
    overviewItems.push({
      key: STATUS_MESSAGE,
      label: 'Status Message:',
      value: span.statusMessage,
    });
  }
  if (span.instrumentationLibraryName) {
    overviewItems.push({
      key: LIBRARY_NAME,
      label: 'Library Name:',
      value: span.instrumentationLibraryName,
    });
  }
  if (span.instrumentationLibraryVersion) {
    overviewItems.push({
      key: LIBRARY_VERSION,
      label: 'Library Version:',
      value: span.instrumentationLibraryVersion,
    });
  }
  if (span.traceState) {
    overviewItems.push({
      key: TRACE_STATE,
      label: 'Trace State:',
      value: span.traceState,
    });
  }

  const createLinkButton = (link: SpanLinkDef, type: SpanLinkType, title: string, icon: IconName) => {
    return (
      <DataLinkButton
        link={{
          ...link,
          title: title,
          target: '_blank',
          origin: link.field,
          onClick: (event: React.MouseEvent) => {
            // DataLinkButton assumes if you provide an onClick event you would want to prevent default behavior like navigation
            // In this case, if an onClick is not defined, restore navigation to the provided href while keeping the tracking
            // this interaction will not be tracked with link right clicks
            reportInteraction('grafana_traces_trace_view_span_link_clicked', {
              datasourceType: datasourceType,
              grafana_version: config.buildInfo.version,
              type,
              location: 'spanDetails',
            });

            if (link.onClick) {
              link.onClick?.(event);
            } else {
              locationService.push(link.href);
            }
          },
        }}
        buttonProps={{ icon }}
      />
    );
  };

  let logLinkButton: JSX.Element | null = null;
  let profileLinkButton: JSX.Element | null = null;
  let sessionLinkButton: JSX.Element | null = null;
  if (createSpanLink) {
    const links = createSpanLink(span);
    const logsLink = links?.filter((link) => link.type === SpanLinkType.Logs);
    if (links && logsLink && logsLink.length > 0) {
      logLinkButton = createLinkButton(logsLink[0], SpanLinkType.Logs, 'Logs for this span', 'gf-logs');
    }
    const profilesLink = links?.filter(
      (link) => link.type === SpanLinkType.Profiles && link.title === RelatedProfilesTitle
    );
    if (links && profilesLink && profilesLink.length > 0) {
      profileLinkButton = createLinkButton(profilesLink[0], SpanLinkType.Profiles, 'Profiles for this span', 'link');
    }
    const sessionLink = links?.filter((link) => link.type === SpanLinkType.Session);
    if (links && sessionLink && sessionLink.length > 0) {
      sessionLinkButton = createLinkButton(
        sessionLink[0],
        SpanLinkType.Session,
        'Session for this span',
        'frontend-observability'
      );
    }
  }

  const focusSpanLink = createFocusSpanLink(traceID, spanID);
  return (
    <div data-testid="span-detail-component">
      <div className={styles.header}>
        <h2 className={styles.operationName} title={operationName}>
          {operationName}
        </h2>
        <div className={styles.listWrapper}>
          <LabeledList className={styles.list} divider={true} items={overviewItems} />
        </div>
      </div>
      <div className={styles.linkList}>
        {logLinkButton}
        {profileLinkButton}
        {sessionLinkButton}
      </div>
      <Divider spacing={1} />
      <div>
        <div>
          <AccordianKeyValues
            data={tags}
            label="Span Attributes"
            linksGetter={linksGetter}
            isOpen={isTagsOpen}
            onToggle={() => tagsToggle(spanID)}
          />
          {process.tags && (
            <AccordianKeyValues
              className={styles.AccordianKeyValuesItem}
              data={process.tags}
              label="Resource Attributes"
              linksGetter={linksGetter}
              isOpen={isProcessOpen}
              onToggle={() => processToggle(spanID)}
            />
          )}
        </div>
        {logs && logs.length > 0 && (
          <AccordianLogs
            linksGetter={linksGetter}
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
            label={<span className={styles.AccordianWarningsLabel}>Warnings</span>}
            data={warnings}
            isOpen={isWarningsOpen}
            onToggle={() => warningsToggle(spanID)}
          />
        )}
        {stackTraces?.length ? (
          <AccordianText
            label="Stack trace"
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
            <Icon name={'link'} className={cx(alignIcon, styles.LinkIcon)}></Icon>
          </a>
          <span className={styles.debugLabel} data-label="SpanID:" /> {spanID}
        </small>
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
