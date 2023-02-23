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
import { get as _get, maxBy as _maxBy, values as _values } from 'lodash';
import * as React from 'react';

import { Badge, BadgeColor, Tooltip, useStyles2 } from '@grafana/ui';

import ExternalLinks from '../common/ExternalLinks';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getSpanWithHeaderTags, getTraceName } from '../model/trace-viewer';
import { formatDuration } from '../utils/date';

import SpanGraph from './SpanGraph';
import { TracePageHeaderEmbedProps, timestamp, getStyles } from './TracePageHeader';

const getNewStyles = () => {
  return {
    subtitle: css`
      flex: 1;
      line-height: 1em;
      margin: -0.5em 0 1.5em 0.5em;
    `,
    tag: css`
      margin: 0 0.5em 0 0;
    `,
    url: css`
      margin: -2.5px 0.3em;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      max-width: 30%;
      display: inline-block;
    `,
    divider: css`
      margin: 0 0.75em;
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

  const spanWithHeaderTags = getSpanWithHeaderTags(trace.spans);

  const title = (
    <h1 className={cx(styles.TracePageHeaderTitle)}>
      <TraceName traceName={getTraceName(trace.spans)} />
      <small>
        <span className={styles.divider}>|</span>
        {formatDuration(trace.duration)}
      </small>
    </h1>
  );

  const method = spanWithHeaderTags?.tags.filter((tag) => {
    return tag.key === 'http.method';
  });

  const status = spanWithHeaderTags?.tags.filter((tag) => {
    return tag.key === 'http.status_code';
  });

  let statusColor: BadgeColor = 'orange';
  if (status && status.length > 0 && Number.isInteger(status[0].value)) {
    if (status[0].value.toString().charAt(0) === '2') {
      statusColor = 'green';
    } else if (status[0].value.toString().charAt(0) === '4') {
      statusColor = 'red';
    }
  }

  const url = spanWithHeaderTags?.tags.filter((tag) => {
    return tag.key === 'http.url' || tag.key === 'http.target';
  });

  return (
    <header className={styles.TracePageHeader}>
      <div className={styles.TracePageHeaderTitleRow}>
        {links && links.length > 0 && <ExternalLinks links={links} className={styles.TracePageHeaderBack} />}
        {title}
      </div>

      <div className={styles.subtitle}>
        {timestamp(trace, timeZone, styles)}
        <span className={styles.divider}>|</span>
        {method && method.length > 0 && (
          <span className={styles.tag}>
            <Badge text={method[0].value} color="blue" />
          </span>
        )}
        {status && status.length > 0 && (
          <span className={styles.tag}>
            <Badge text={status[0].value} color={statusColor} />
          </span>
        )}
        {url && url.length > 0 && (
          <Tooltip content={url[0].value} interactive={true}>
            <span className={styles.url}>{url[0].value}</span>
          </Tooltip>
        )}
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
