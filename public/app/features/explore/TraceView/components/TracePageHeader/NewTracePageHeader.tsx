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
import { get, maxBy, values } from 'lodash';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, BadgeColor, Icon, Tooltip, useStyles2 } from '@grafana/ui';

import { autoColor } from '../Theme';
import ExternalLinks from '../common/ExternalLinks';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getHeaderTags, getTraceName } from '../model/trace-viewer';
import { formatDuration } from '../utils/date';

import TracePageActions from './Actions/TracePageActions';
import SpanGraph from './SpanGraph';
import { TracePageHeaderEmbedProps, timestamp, getStyles } from './TracePageHeader';

const getNewStyles = (theme: GrafanaTheme2) => {
  return {
    titleRow: css`
      label: TracePageHeaderTitleRow;
      align-items: center;
      display: flex;
      padding: 0 0.5em 0 0.5em;
    `,
    title: css`
      label: TracePageHeaderTitle;
      color: inherit;
      flex: 1;
      font-size: 1.7em;
      line-height: 1em;
    `,
    subtitle: css`
      flex: 1;
      line-height: 1em;
      margin: -0.5em 0.5em 0.75em 0.5em;
    `,
    duration: css`
      color: #aaa;
      margin: 0 0.75em;
    `,
    tooltip: css`
      color: #aaa;
      margin: -14px 0.5em 0 0;
    `,
    timestamp: css`
      vertical-align: middle;
    `,
    tagMeta: css`
      margin: 0 0.75em;
      vertical-align: text-top;
    `,
    tag: css`
      margin: 0 0.5em 0 0;
    `,
    total: css`
      vertical-align: middle;
    `,
    header: css`
      label: TracePageHeader;
      background-color: ${theme.colors.background.primary};
      position: sticky;
      top: 0;
      z-index: 5;
      padding: 0.5em 0.25em 0 0.25em;
      & > :last-child {
        border-bottom: 1px solid ${autoColor(theme, '#ccc')};
      }
    `,
  };
};

export function NewTracePageHeader(props: TracePageHeaderEmbedProps) {
  const { trace, updateNextViewRangeTime, updateViewRangeTime, viewRange, timeZone } = props;

  const styles = { ...useStyles2(getStyles), ...useStyles2(getNewStyles) };
  const links = React.useMemo(() => {
    if (!trace) {
      return [];
    }
    return getTraceLinks(trace);
  }, [trace]);

  if (!trace) {
    return null;
  }

  const { method, status } = getHeaderTags(trace.spans);

  const tooltip = () => {
    const services = new Set(values(trace.processes).map((p) => p.serviceName)).size;
    const depth = get(maxBy(trace.spans, 'depth'), 'depth', 0) + 1;

    return (
      <>
        <div>Services: {services}</div>
        <div>Depth: {depth}</div>
      </>
    );
  };

  const title = (
    <h1 className={cx(styles.title)}>
      <TraceName traceName={getTraceName(trace.spans)} />
      <small className={styles.duration}>{formatDuration(trace.duration)}</small>
      <Tooltip content={tooltip} interactive={true}>
        <span className={styles.tooltip}>
          <Icon name="info-circle" size="lg" />
        </span>
      </Tooltip>
    </h1>
  );

  let statusColor: BadgeColor = 'green';
  if (status && status.length > 0) {
    if (status[0].value.toString().charAt(0) === '4') {
      statusColor = 'orange';
    } else if (status[0].value.toString().charAt(0) === '5') {
      statusColor = 'red';
    }
  }

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {title}
        <TracePageActions traceId={trace.traceID} />
      </div>

      <div className={styles.subtitle}>
        <span className={styles.timestamp}>{timestamp(trace, timeZone, styles)}</span>
        <span className={styles.tagMeta}>
          {method && method.length > 0 && (
            <Tooltip content={'http.method'} interactive={true}>
              <span className={styles.tag}>
                <Badge text={method[0].value} color="blue" />
              </span>
            </Tooltip>
          )}
          {status && status.length > 0 && (
            <Tooltip content={'http.status_code'} interactive={true}>
              <span className={styles.tag}>
                <Badge text={status[0].value} color={statusColor} />
              </span>
            </Tooltip>
          )}
          <span className={styles.total}>Total Spans: {trace.spans.length}</span>
        </span>
      </div>

      <SpanGraph
        trace={trace}
        viewRange={viewRange}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
      />
    </header>
  );
}
