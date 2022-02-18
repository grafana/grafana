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

import React from 'react';
import { css } from '@emotion/css';
import cx from 'classnames';
import { DataLinkButton, TextArea, useStyles2 } from '@grafana/ui';
import { GrafanaTheme2, LinkModel } from '@grafana/data';
import IoLink from 'react-icons/lib/io/link';

import AccordianKeyValues from './AccordianKeyValues';
import AccordianLogs from './AccordianLogs';
import AccordianText from './AccordianText';
import DetailState from './DetailState';
import { formatDuration } from '../utils';
import LabeledList from '../../common/LabeledList';
import { SpanLinkFunc, TNil } from '../../types';
import { TraceKeyValuePair, TraceLink, TraceLog, TraceSpan, TraceSpanReference } from '../../types/trace';
import AccordianReferences from './AccordianReferences';
import { autoColor } from '../../Theme';
import { Divider } from '../../common/Divider';
import {
  uAlignIcon,
  ubFlex,
  ubFlexAuto,
  ubItemsCenter,
  ubM0,
  ubMb1,
  ubMy1,
  ubTxRightAlign,
} from '../../uberUtilityStyles';

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
  tagsToggle: (spanID: string) => void;
  traceStartTime: number;
  warningsToggle: (spanID: string) => void;
  stackTracesToggle: (spanID: string) => void;
  referenceItemToggle: (spanID: string, reference: TraceSpanReference) => void;
  referencesToggle: (spanID: string) => void;
  focusSpan: (uiFind: string) => void;
  createSpanLink?: SpanLinkFunc;
  focusedSpanId?: string;
  createFocusSpanLink: (traceId: string, spanId: string) => LinkModel;
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
    focusSpan,
    createSpanLink,
    createFocusSpanLink,
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
    traceID,
    spanID,
    logs,
    tags,
    warnings,
    references,
    stackTraces,
  } = span;
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
      value: formatDuration(relativeStartTime),
    },
  ];
  const styles = useStyles2(getStyles);
  const link = createSpanLink?.(span);
  const focusSpanLink = createFocusSpanLink(traceID, spanID);

  return (
    <div>
      <div className={cx(ubFlex, ubItemsCenter, ubMb1)}>
        <h2 className={cx(ubFlexAuto, ubM0)}>{operationName}</h2>
        <LabeledList className={ubTxRightAlign} items={overviewItems} />
      </div>
      {link ? (
        <DataLinkButton link={{ ...link, title: 'Logs for this span' } as any} buttonProps={{ icon: 'gf-logs' }} />
      ) : null}
      <Divider className={ubMy1} type={'horizontal'} />
      <div>
        <div>
          <AccordianKeyValues
            data={tags}
            label="Tags"
            linksGetter={linksGetter}
            isOpen={isTagsOpen}
            onToggle={() => tagsToggle(spanID)}
          />
          {process.tags && (
            <AccordianKeyValues
              className={ubMb1}
              data={process.tags}
              label="Process"
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
            focusSpan={focusSpan}
          />
        )}
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
      </div>
    </div>
  );
}
