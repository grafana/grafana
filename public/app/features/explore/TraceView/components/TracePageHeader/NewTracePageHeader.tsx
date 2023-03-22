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
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useToggle } from 'react-use';

import { toOption, GrafanaTheme2 } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import {
  Badge,
  BadgeColor,
  Collapse,
  HorizontalGroup,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
  Tooltip,
  useStyles2,
} from '@grafana/ui';
import { TagsFilterField } from 'app/plugins/datasource/tempo/SpanFilters/TagsFilterField';

import { SearchProps } from '../../useSearch';
import { autoColor } from '../Theme';
import { ViewRangeTimeUpdate, TUpdateViewRangeTimeFunction, ViewRange } from '../TraceTimelineViewer/types';
import ExternalLinks from '../common/ExternalLinks';
import TraceName from '../common/TraceName';
import { getTraceLinks } from '../model/link-patterns';
import { getHeaderTags, getTraceName } from '../model/trace-viewer';
import { Trace } from '../types';
import { formatDuration } from '../utils/date';

import TracePageActions from './Actions/TracePageActions';
import SpanGraph from './SpanGraph';
import { timestamp, getStyles } from './TracePageHeader';
import TracePageSearchBar from './TracePageSearchBar';

export type NewTracePageHeaderProps = {
  trace: Trace | null;
  updateNextViewRangeTime: (update: ViewRangeTimeUpdate) => void;
  updateViewRangeTime: TUpdateViewRangeTimeFunction;
  viewRange: ViewRange;
  timeZone: TimeZone;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  searchMatches: Set<string> | undefined;
  focusedSearchMatch: string;
  setFocusedSearchMatch: React.Dispatch<React.SetStateAction<string>>; // TODO JOEY: rename to setSearchMatches or just useSearch
};

export function NewTracePageHeader(props: NewTracePageHeaderProps) {
  const {
    trace,
    updateNextViewRangeTime,
    updateViewRangeTime,
    viewRange,
    timeZone,
    search,
    setSearch,
    searchMatches,
    focusedSearchMatch,
    setFocusedSearchMatch,
  } = props;
  const styles = { ...useStyles2(getStyles), ...useStyles2(getNewStyles) };
  const [tags, setTags] = useState('');
  const [showSpanFilters, setShowSpanFilters] = useToggle(true);

  // const handleServiceNameChange = useCallback(
  //   (e) => {
  //     setFocusedSearchMatch('');
  //     setSearch({
  //       ...search,
  //       serviceName: e?.value || '',
  //     });
  //   },
  //   [search, setFocusedSearchMatch, setSearch]
  // );

  const serviceNameOptions = (trace: Trace) => {
    return [
      ...new Set(
        trace.spans.map((span) => {
          return span.process.serviceName;
        })
      ),
    ].map((name) => {
      return toOption(name);
    });
  };

  const spanNameOptions = (trace: Trace) => {
    console.log('rendering');
    return [
      ...new Set(
        trace.spans.map((span) => {
          return span.operationName;
        })
      ),
    ].map((name) => {
      return toOption(name);
    });
  };

  useEffect(() => {
    if (tags !== search.tags) {
      setSearch({
        ...search,
        tags: tags,
      });
    }
  }, [tags, search, setSearch]);

  const links = React.useMemo(() => {
    if (!trace) {
      return [];
    }
    return getTraceLinks(trace);
  }, [trace]);

  if (!trace) {
    return null;
  }

  const { method, status, url } = getHeaderTags(trace.spans);

  const title = (
    <h1 className={cx(styles.title)}>
      <TraceName traceName={getTraceName(trace.spans)} />
      <small>
        <span className={styles.divider}>|</span>
        {formatDuration(trace.duration)}
      </small>
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
        {timestamp(trace, timeZone, styles)}
        {method || status || url ? <span className={styles.divider}>|</span> : undefined}
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
        {url && url.length > 0 && (
          <Tooltip content={'http.url or http.target or http.path'} interactive={true}>
            <span className={styles.url}>{url[0].value}</span>
          </Tooltip>
        )}
      </div>

      <Collapse label="Span Filters" collapsible={true} isOpen={showSpanFilters} onToggle={setShowSpanFilters}>
        <InlineFieldRow>
          <InlineField label="Service Name" labelWidth={16}>
            <HorizontalGroup spacing={'none'}>
              <Select
                options={[toOption('='), toOption('!=')]}
                value={search.serviceNameOperator}
                onChange={(e) => setSearch({ ...search, serviceNameOperator: e?.value || '' })}
              />
              <Select
                placeholder="All service names"
                options={serviceNameOptions(trace)}
                onChange={(e) => setSearch({ ...search, serviceName: e?.value || '' })}
                isClearable
                aria-label={'select-service-name'}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Span Name" labelWidth={16}>
            <HorizontalGroup spacing={'none'}>
              <Select
                options={[toOption('='), toOption('!=')]}
                value={search.spanNameOperator}
                onChange={(e) => setSearch({ ...search, spanNameOperator: e?.value || '' })}
              />
              <Select
                placeholder="All span names"
                options={spanNameOptions(trace)}
                onChange={(e) => setSearch({ ...search, spanName: e?.value || '' })}
                isClearable
                aria-label={'select-span-name'}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Duration" labelWidth={16}>
            <HorizontalGroup spacing={'none'}>
              <Select
                options={[toOption('>'), toOption('>=')]}
                value={search.fromOperator}
                onChange={(e) => setSearch({ ...search, fromOperator: e?.value || '' })}
              />
              <Input
                placeholder="e.g. 100ms, 1.2s"
                value={search.from}
                onChange={(v) => setSearch({ ...search, from: v.currentTarget.value || '' })}
                // invalid={invalid}
                width={18}
              />
              <Select
                options={[toOption('<'), toOption('<=')]}
                value={search.toOperator}
                onChange={(e) => setSearch({ ...search, toOperator: e?.value || '' })}
              />
              <Input
                placeholder="e.g. 100ms, 1.2s"
                value={search.to}
                onChange={(v) => setSearch({ ...search, to: v.currentTarget.value || '' })}
                // invalid={invalid}
                width={18}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tags" labelWidth={16} tooltip="Values should be in logfmt.">
            <TagsFilterField
              placeholder="http.status_code=200 error=true"
              value={tags}
              onChange={(x) => setTags(x)}
              tags={trace.spans
                .map((span) => {
                  return span.tags;
                })
                .flat()}
            />
          </InlineField>
        </InlineFieldRow>
        <TracePageSearchBar
          // searchValue={search}
          searchMatches={searchMatches}
          focusedSearchMatch={focusedSearchMatch}
          setFocusedSearchMatch={setFocusedSearchMatch}
          // datasourceType={datasourceType}
        />
      </Collapse>

      <SpanGraph
        trace={trace}
        viewRange={viewRange}
        updateNextViewRangeTime={updateNextViewRangeTime}
        updateViewRangeTime={updateViewRangeTime}
      />
    </header>
  );
}

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
      margin: -0.5em 0.5em 1em 0.5em;
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
