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
import React, { useState, useEffect, memo, useCallback } from 'react';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { IntervalInput } from '@grafana/o11y-ds-frontend';
import { Collapse, HorizontalGroup, Icon, InlineField, InlineFieldRow, Select, Tooltip, useStyles2 } from '@grafana/ui';

import { defaultFilters, SearchProps } from '../../../useSearch';
import { getTraceServiceNames, getTraceSpanNames } from '../../../utils/tags';
import SearchBarInput from '../../common/SearchBarInput';
import { Trace } from '../../types';
import NextPrevResult from '../SearchBar/NextPrevResult';
import TracePageSearchBar from '../SearchBar/TracePageSearchBar';

import { SpanFiltersTags } from './SpanFiltersTags';

export type SpanFilterProps = {
  trace: Trace;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  showSpanFilters: boolean;
  setShowSpanFilters: (isOpen: boolean) => void;
  setFocusedSpanIdForSearch: React.Dispatch<React.SetStateAction<string>>;
  spanFilterMatches: Set<string> | undefined;
  datasourceType: string;
};

export const SpanFilters = memo((props: SpanFilterProps) => {
  const {
    trace,
    search,
    setSearch,
    showSpanFilters,
    setShowSpanFilters,
    setFocusedSpanIdForSearch,
    spanFilterMatches,
    datasourceType,
  } = props;
  const styles = { ...useStyles2(getStyles) };
  const [serviceNames, setServiceNames] = useState<Array<SelectableValue<string>>>();
  const [spanNames, setSpanNames] = useState<Array<SelectableValue<string>>>();
  const [focusedSpanIndexForSearch, setFocusedSpanIndexForSearch] = useState(-1);
  const [tagKeys, setTagKeys] = useState<Array<SelectableValue<string>>>();
  const [tagValues, setTagValues] = useState<{ [key: string]: Array<SelectableValue<string>> }>({});

  const durationRegex = /^\d+(?:\.\d)?\d*(?:ns|us|µs|ms|s|m|h)$/;

  const clear = useCallback(() => {
    setServiceNames(undefined);
    setSpanNames(undefined);
    setTagKeys(undefined);
    setTagValues({});
    setSearch(defaultFilters);
  }, [setSearch]);

  useEffect(() => {
    clear();
  }, [clear, trace]);

  const setShowSpanFilterMatchesOnly = useCallback(
    (showMatchesOnly: boolean) => {
      setSearch({ ...search, matchesOnly: showMatchesOnly });
    },
    [search, setSearch]
  );

  const setShowCriticalPathSpansOnly = useCallback(
    (showCriticalPathSpansOnly: boolean) => {
      setSearch({ ...search, criticalPathOnly: showCriticalPathSpansOnly });
    },
    [search, setSearch]
  );

  if (!trace) {
    return null;
  }

  const setSpanFiltersSearch = (spanSearch: SearchProps) => {
    setFocusedSpanIndexForSearch(-1);
    setFocusedSpanIdForSearch('');
    setSearch(spanSearch);
  };

  const getServiceNames = () => {
    if (!serviceNames) {
      setServiceNames(getTraceServiceNames(trace).map(toOption));
    }
  };

  const getSpanNames = () => {
    if (!spanNames) {
      setSpanNames(getTraceSpanNames(trace).map(toOption));
    }
  };

  const collapseLabel = (
    <>
      <Tooltip
        content="Filter your spans below. You can continue to apply filters until you have narrowed down your resulting spans to the select few you are most interested in."
        placement="right"
      >
        <span className={styles.collapseLabel}>
          Span Filters
          <Icon size="md" name="info-circle" />
        </span>
      </Tooltip>

      {!showSpanFilters && (
        <div className={styles.nextPrevResult}>
          <NextPrevResult
            trace={trace}
            spanFilterMatches={spanFilterMatches}
            setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
            focusedSpanIndexForSearch={focusedSpanIndexForSearch}
            setFocusedSpanIndexForSearch={setFocusedSpanIndexForSearch}
            datasourceType={datasourceType}
            showSpanFilters={showSpanFilters}
          />
        </div>
      )}
    </>
  );

  return (
    <div className={styles.container}>
      <Collapse label={collapseLabel} collapsible={true} isOpen={showSpanFilters} onToggle={setShowSpanFilters}>
        <InlineFieldRow className={styles.flexContainer}>
          <InlineField label="Service Name" labelWidth={16}>
            <HorizontalGroup spacing={'xs'}>
              <Select
                aria-label="Select service name operator"
                onChange={(v) => setSpanFiltersSearch({ ...search, serviceNameOperator: v.value! })}
                options={[toOption('='), toOption('!=')]}
                value={search.serviceNameOperator}
              />
              <Select
                aria-label="Select service name"
                isClearable
                onChange={(v) => setSpanFiltersSearch({ ...search, serviceName: v?.value || '' })}
                onOpenMenu={getServiceNames}
                options={serviceNames || (search.serviceName ? [search.serviceName].map(toOption) : [])}
                placeholder="All service names"
                value={search.serviceName || null}
                defaultValue={search.serviceName || null}
              />
            </HorizontalGroup>
          </InlineField>
          <SearchBarInput
            onChange={(v) => {
              setSpanFiltersSearch({ ...search, query: v, matchesOnly: v !== '' });
            }}
            value={search.query || ''}
          />
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Span Name" labelWidth={16}>
            <HorizontalGroup spacing={'xs'}>
              <Select
                aria-label="Select span name operator"
                onChange={(v) => setSpanFiltersSearch({ ...search, spanNameOperator: v.value! })}
                options={[toOption('='), toOption('!=')]}
                value={search.spanNameOperator}
              />
              <Select
                aria-label="Select span name"
                isClearable
                onChange={(v) => setSpanFiltersSearch({ ...search, spanName: v?.value || '' })}
                onOpenMenu={getSpanNames}
                options={spanNames || (search.spanName ? [search.spanName].map(toOption) : [])}
                placeholder="All span names"
                value={search.spanName || null}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField
            label="Duration"
            labelWidth={16}
            tooltip="Filter by duration. Accepted units are ns, us, ms, s, m, h"
          >
            <HorizontalGroup spacing="xs" align="flex-start">
              <Select
                aria-label="Select min span operator"
                onChange={(v) => setSpanFiltersSearch({ ...search, fromOperator: v.value! })}
                options={[toOption('>'), toOption('>=')]}
                value={search.fromOperator}
              />
              <div className={styles.intervalInput}>
                <IntervalInput
                  ariaLabel="Select min span duration"
                  onChange={(val) => setSpanFiltersSearch({ ...search, from: val })}
                  isInvalidError="Invalid duration"
                  placeholder="e.g. 100ms, 1.2s"
                  width={18}
                  value={search.from || ''}
                  validationRegex={durationRegex}
                />
              </div>
              <Select
                aria-label="Select max span operator"
                onChange={(v) => setSpanFiltersSearch({ ...search, toOperator: v.value! })}
                options={[toOption('<'), toOption('<=')]}
                value={search.toOperator}
              />
              <IntervalInput
                ariaLabel="Select max span duration"
                onChange={(val) => setSpanFiltersSearch({ ...search, to: val })}
                isInvalidError="Invalid duration"
                placeholder="e.g. 100ms, 1.2s"
                width={18}
                value={search.to || ''}
                validationRegex={durationRegex}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow className={styles.tagsRow}>
          <InlineField label="Tags" labelWidth={16} tooltip="Filter by tags, process tags or log fields in your spans.">
            <SpanFiltersTags
              search={search}
              setSearch={setSpanFiltersSearch}
              trace={trace}
              tagKeys={tagKeys}
              setTagKeys={setTagKeys}
              tagValues={tagValues}
              setTagValues={setTagValues}
            />
          </InlineField>
        </InlineFieldRow>

        <TracePageSearchBar
          trace={trace}
          search={search}
          spanFilterMatches={spanFilterMatches}
          setShowSpanFilterMatchesOnly={setShowSpanFilterMatchesOnly}
          setShowCriticalPathSpansOnly={setShowCriticalPathSpansOnly}
          setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
          focusedSpanIndexForSearch={focusedSpanIndexForSearch}
          setFocusedSpanIndexForSearch={setFocusedSpanIndexForSearch}
          datasourceType={datasourceType}
          clear={clear}
          showSpanFilters={showSpanFilters}
        />
      </Collapse>
    </div>
  );
});

SpanFilters.displayName = 'SpanFilters';

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    label: 'SpanFilters',
    margin: `0.5em 0 -${theme.spacing(1)} 0`,
    zIndex: 5,

    '& > div': {
      borderLeft: 'none',
      borderRight: 'none',
    },
  }),
  collapseLabel: css({
    svg: {
      color: '#aaa',
      margin: '-2px 0 0 10px',
    },
  }),
  flexContainer: css({
    display: 'flex',
    justifyContent: 'space-between',
  }),
  intervalInput: css({
    margin: '0 -4px 0 0',
  }),
  tagsRow: css({
    margin: '-4px 0 0 0',
  }),
  nextPrevResult: css({
    flex: 1,
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'flex-end',
    marginRight: theme.spacing(1),
  }),
});
