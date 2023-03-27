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
import * as React from 'react';
import { useToggle } from 'react-use';

import { toOption } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Collapse, HorizontalGroup, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';

import { SearchProps } from '../../../useSearch';
import { Trace } from '../../types';
import { getTagsFromSpan, randomId } from '../../utils/filter-spans';
import TracePageSearchBar from '../TracePageSearchBar';

export type SpanFilterProps = {
  trace: Trace | null;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  searchMatches: Set<string> | undefined;
  focusedSearchMatch: string;
  setFocusedSearchMatch: React.Dispatch<React.SetStateAction<string>>;
};

export function SpanFilters(props: SpanFilterProps) {
  const { trace, search, setSearch, searchMatches, focusedSearchMatch, setFocusedSearchMatch } = props;
  const styles = { ...useStyles2(getStyles) };
  const [showSpanFilters, setShowSpanFilters] = useToggle(true);

  if (!trace) {
    return null;
  }

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

  // TODO: JOEY: move span filters to new component (in SpanFilters folder)

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

  const tagOptions = (trace: Trace, type: 'keys' | 'values') => {
    // console.log('rendering');
    return [
      ...new Set(
        trace.spans
          .map((span) => {
            return getTagsFromSpan(span, type);
          })
          .flat()
          .sort()
      ),
    ].map((name) => {
      return toOption(name);
    });
  };

  const addTag = () => {
    console.log('add tag');
    let tags = search.tags;
    tags.push({
      id: randomId(),
      operator: '=',
    });
    setSearch({ ...search, tags: tags });
  };

  return (
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
        <InlineField label="Tags" labelWidth={16}>
          <div>
            {search.tags?.map((tag, i) => (
              <div key={i} className={styles.queryRow}>
                <Select
                  options={tagOptions(trace, 'keys')}
                  value={tag.key}
                  onChange={(e) => {
                    let tags = search.tags?.map((x) => {
                      return x.id === tag.id ? { ...x, key: e?.value || '' } : x;
                    });
                    setSearch({ ...search, tags: tags });
                  }}
                  placeholder="service.name"
                />
                <Select
                  options={[toOption('='), toOption('!=')]}
                  value={tag.operator}
                  onChange={(e) => {
                    let tags = search.tags?.map((x) => {
                      return x.id === tag.id ? { ...x, operator: e?.value || '' } : x;
                    });
                    setSearch({ ...search, tags: tags });
                  }}
                  width={18}
                />
                <Select
                  options={tagOptions(trace, 'values')}
                  value={tag.value}
                  onChange={(e) => {
                    let tags = search.tags?.map((x) => {
                      return x.id === tag.id ? { ...x, value: e?.value || '' } : x;
                    });
                    setSearch({ ...search, tags: tags });
                  }}
                  placeholder="app"
                />
                {search?.tags?.length && i === search.tags.length - 1 && (
                  <AccessoryButton variant={'secondary'} icon={'plus'} onClick={addTag} title={'Add tag'} />
                )}
              </div>
            ))}
          </div>
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
  );
}

const getStyles = () => {
  return {
    queryRow: css`
      display: flex;
    `,
  };
};
