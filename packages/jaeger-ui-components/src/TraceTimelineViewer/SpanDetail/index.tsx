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
import cx from 'classnames';
import React from 'react';
import IoLink from 'react-icons/lib/io/link';

import { dateTimeFormat, GrafanaTheme2, LinkModel, TimeZone } from '@grafana/data';
import { DataLinkButton, TextArea, useStyles2 } from '@grafana/ui';

import { autoColor } from '../../Theme';
import { Divider } from '../../common/Divider';
import LabeledList from '../../common/LabeledList';
import { SpanLinkFunc, TNil } from '../../types';
import { TraceKeyValuePair, TraceLink, TraceLog, TraceSpan, TraceSpanReference } from '../../types/trace';
import { uAlignIcon, ubM0, ubMb1, ubMy1, ubTxRightAlign } from '../../uberUtilityStyles';
import { TopOfViewRefType } from '../VirtualizedTraceView';
import { formatDuration } from '../utils';

import AccordianKeyValues from './AccordianKeyValues';
import AccordianLogs from './AccordianLogs';
import AccordianReferences from './AccordianReferences';
import AccordianText from './AccordianText';
import DetailState from './DetailState';

const getStyles = (theme: GrafanaTheme2) => {
  return {
    header: css`
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0 1rem;
      margin-bottom: 0.25rem;
    `,
    listWrapper: css`
      overflow: hidden;
    `,
    debugInfo: css`
      label: debugInfo;
      display: block;
      letter-spacing: 0.25px;
      margin: 0.5em 0 -0.75em;
      text-align: right;
    `,
    debugLabel: css`
      label: debugLabel;
      &::before {
        color: ${autoColor(theme, '#bbb')};
        content: attr(data-label);
      }
    `,
    debugValue: css`
      label: debugValue;
      background-color: inherit;
      border: none;
      color: ${autoColor(theme, '#888')};
      cursor: pointer;
      &:hover {
        color: ${autoColor(theme, '#333')};
      }
    `,
    AccordianWarnings: css`
      label: AccordianWarnings;
      background: ${autoColor(theme, '#fafafa')};
      border: 1px solid ${autoColor(theme, '#e4e4e4')};
      margin-bottom: 0.25rem;
    `,
    AccordianWarningsHeader: css`
      label: AccordianWarningsHeader;
      background: ${autoColor(theme, '#fff7e6')};
      padding: 0.25rem 0.5rem;
      &:hover {
        background: ${autoColor(theme, '#ffe7ba')};
      }
    `,
    AccordianWarningsHeaderOpen: css`
      label: AccordianWarningsHeaderOpen;
      border-bottom: 1px solid ${autoColor(theme, '#e8e8e8')};
    `,
    AccordianWarningsLabel: css`
      label: AccordianWarningsLabel;
      color: ${autoColor(theme, '#d36c08')};
    `,
    Textarea: css`
      word-break: break-all;
      white-space: pre;
    `,
    LinkIcon: css`
      font-size: 1.5em;
    `,
  };
};

type SpanDetailProps = {
  detailState: DetailState;
  linksGetter: ((links: TraceKeyValuePair[], index: number) => TraceLink[]) | TNil;
  logItemToggle: (spanID: string, log: TraceLog) => void;
  logsToggle: (spanID: string) => void;
  processToggle: (spanID: string) => void;
  span: TraceSpan;
  timeZone: TimeZone;
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  warningsToggle: (spanID: string) => void;
  stackTracesToggle: (spanID: string) => void;
  referenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  referencesToggle: (spanID: string) => void;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
  topOfViewRefType?: TopOfViewRefType;
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
    warningsToggle,
    stackTracesToggle,
    referencesToggle,
    referenceItemToggle,
    createSpanLink,
    createFocusSpanLink,
    topOfViewRefType,
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
  const styles = useStyles2(getStyles);
  const links = createSpanLink?.(span);
  const focusSpanLink = createFocusSpanLink(traceID, spanID);

  return (
    <div data-testid="span-detail-component">
      <div className={styles.header}>
        <h2 className={cx(ubM0)}>{operationName}</h2>
        <div className={styles.listWrapper}>
          <LabeledList className={ubTxRightAlign} divider={true} items={overviewItems} />
        </div>
      </div>
      {links?.logLinks?.[0] ? (
        <DataLinkButton
          link={{ ...links?.logLinks?.[0], title: 'Logs for this span' } as any}
          buttonProps={{ icon: 'gf-logs' }}
        />
      ) : null}
      <Divider className={ubMy1} type={'horizontal'} />
      <div>
        <div>
          <AccordianKeyValues
            data={tags}
            label="Attributes"
            linksGetter={linksGetter}
            isOpen={isTagsOpen}
            onToggle={() => tagsToggle(spanID)}
          />
          {process.tags && (
            <AccordianKeyValues
              className={ubMb1}
              data={process.tags}
              label="Resource"
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
        {stackTraces && stackTraces.length && (
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
        )}
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
        {topOfViewRefType === TopOfViewRefType.Explore && (
          <small className={styles.debugInfo}>
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
              <IoLink className={cx(uAlignIcon, styles.LinkIcon)}></IoLink>
            </a>
            <span className={styles.debugLabel} data-label="SpanID:" /> {spanID}
          </small>
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
