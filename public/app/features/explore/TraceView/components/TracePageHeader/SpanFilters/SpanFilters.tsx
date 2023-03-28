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
import { useCallback, useEffect, useState } from 'react';
import { useToggle } from 'react-use';

import { toOption } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Collapse, HorizontalGroup, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';

import { SearchProps } from '../../../useSearch';
import { Trace } from '../../types';
import { randomId } from '../../utils/filter-spans';
import TracePageSearchBar from '../TracePageSearchBar';

export type SpanFilterProps = {
  trace: Trace;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  searchMatches: Set<string> | undefined;
  focusedSearchMatch: string;
  setFocusedSearchMatch: React.Dispatch<React.SetStateAction<string>>;
};

interface SpanData {
  serviceNames: string[];
  spanNames: string[];
  tagKeys: string[];
  tagValues: string[];
}

export const SpanFilters = React.memo((props: SpanFilterProps) => {
  const { trace, search, setSearch, searchMatches, focusedSearchMatch, setFocusedSearchMatch } = props;
  const styles = { ...useStyles2(getStyles) };
  const [showSpanFilters, setShowSpanFilters] = useToggle(true);
  const [spanData, setSpanData] = useState<SpanData>({
    serviceNames: [],
    spanNames: [],
    tagKeys: [],
    tagValues: [],
  });

  // TODO: combine all options methods into one iteration of all spans and return object
  // combine getTagsFromSpan with useSearch

  useEffect(() => {
    const serviceNames: string[] = [];
    const spanNames: string[] = [];
    const tagKeys: string[] = [];
    const tagValues: string[] = [];

    trace.spans.map((span) => {
      serviceNames.push(span.process.serviceName);
      spanNames.push(span.operationName);

      span.tags.map((tag) => {
        tagKeys.push(tag.key.toString());
        tagValues.push(tag.value.toString());
      });

      span.process.tags.map((tag) => {
        tagKeys.push(tag.key.toString());
        tagValues.push(tag.value.toString());
      });

      // if (span.logs !== null) {
      //   span.logs.map((log) => {
      //     log.fields.map((field) => {
      //       tagKeys.push(field.key.toString());
      //       tagValues.push(field.value.toString());
      //     });
      //   });
      // }
    });

    const spanData = {
      serviceNames,
      spanNames,
      tagKeys,
      tagValues,
    };

    console.log('spanData', spanData);
    setSpanData(spanData);
  }, [trace]);

  const serviceNameOptions = () => {
    console.log('serviceNameOptions');
    return [...new Set(spanData.serviceNames)].sort().map((name) => {
      return toOption(name);
    });
  };

  const spanNameOptions = () => {
    console.log('spanNameOptions');
    return [...new Set(spanData.spanNames)].sort().map((name) => {
      return toOption(name);
    });
  };

  const allTagOptions = () => {
    console.log('allTagOptions');
    return {
      keys: getDedupedOptions(spanData.tagKeys),
      values: getDedupedOptions(spanData.tagValues),
    };
  };

  const getDedupedOptions = (options: string[]) => {
    return [...new Set(options)].sort().map((name) => {
      return toOption(name);
    });
  };

  const tagOptions = allTagOptions();

  const addTag = () => {
    console.log('add tag');
    let tags = search.tags;
    tags.push({
      id: randomId(),
      operator: '=',
    });
    setSearch({ ...search, tags: tags });
  };

  const removeTag = (id: string) => {
    console.log('remove tag');
    let tags = [...search.tags];
    tags = tags.filter((tag) => {
      return tag.id !== id;
    });
    if (tags.length === 0) {
      const newId = randomId();
      console.log(newId);
      tags = [
        {
          id: newId,
          operator: '=',
          hideText: true,
        },
      ];
    }
    setSearch({ ...search, tags: tags });
  };

  if (!trace) {
    return null;
  }

  console.log('render SpanFilters');

  return (
    <Collapse label="Span Filters" collapsible={true} isOpen={showSpanFilters} onToggle={setShowSpanFilters}>
      <InlineFieldRow>
        <InlineField label="Service Name" labelWidth={16}>
          <HorizontalGroup spacing={'none'}>
            <Select
              onChange={(v) => setSearch({ ...search, serviceNameOperator: v?.value || '=' })}
              options={[toOption('='), toOption('!=')]}
              value={search.serviceNameOperator}
            />
            <Select
              aria-label={'select-service-name'}
              isClearable
              onChange={(v) => {
                console.log('serviceName change');
                setSearch({ ...search, serviceName: v?.value || '' });
              }}
              options={serviceNameOptions()}
              placeholder="All service names"
            />
          </HorizontalGroup>
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Span Name" labelWidth={16}>
          <HorizontalGroup spacing={'none'}>
            <Select
              onChange={(v) => setSearch({ ...search, spanNameOperator: v?.value || '=' })}
              options={[toOption('='), toOption('!=')]}
              value={search.spanNameOperator}
            />
            <Select
              aria-label={'select-span-name'}
              isClearable
              onChange={(v) => setSearch({ ...search, spanName: v?.value || '' })}
              options={spanNameOptions()}
              placeholder="All span names"
            />
          </HorizontalGroup>
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Duration" labelWidth={16}>
          <HorizontalGroup spacing={'none'}>
            <Select
              onChange={(v) => setSearch({ ...search, fromOperator: v?.value || '>' })}
              options={[toOption('>'), toOption('>=')]}
              value={search.fromOperator}
            />
            <Input
              // invalid={invalid}
              onChange={(v) => setSearch({ ...search, from: v.currentTarget.value })}
              placeholder="e.g. 100ms, 1.2s"
              value={search.from}
              width={18}
            />
            <Select
              onChange={(v) => setSearch({ ...search, toOperator: v?.value || '<' })}
              options={[toOption('<'), toOption('<=')]}
              value={search.toOperator}
            />
            <Input
              // invalid={invalid}
              onChange={(v) => setSearch({ ...search, to: v.currentTarget.value })}
              placeholder="e.g. 100ms, 1.2s"
              value={search.to}
              width={18}
            />
          </HorizontalGroup>
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Tags" labelWidth={16}>
          <div>
            {search.tags.map((tag, i) => (
              <div key={i}>
                <HorizontalGroup spacing={'none'} width={'auto'}>
                  <Select
                    aria-label={`select tag`}
                    inputId={`${tag.id}-tag`}
                    isClearable
                    onChange={(v) => {
                      setSearch({
                        ...search,
                        tags: search.tags?.map((x) => {
                          return x.id === tag.id ? { ...x, key: v?.value || '' } : x;
                        }),
                      });
                    }}
                    options={tagOptions.keys}
                    placeholder="Select tag"
                    value={tag.key}
                  />
                  <Select
                    options={[toOption('='), toOption('!=')]}
                    onChange={(v) => {
                      setSearch({
                        ...search,
                        tags: search.tags?.map((x) => {
                          return x.id === tag.id ? { ...x, operator: v?.value || '=' } : x;
                        }),
                      });
                    }}
                    value={tag.operator}
                  />
                  <Select
                    isClearable
                    options={tagOptions.values}
                    onChange={(v) => {
                      setSearch({
                        ...search,
                        tags: search.tags?.map((x) => {
                          return x.id === tag.id ? { ...x, value: v?.value || '' } : x;
                        }),
                      });
                    }}
                    placeholder="Select value"
                    value={tag.value}
                  />
                  <AccessoryButton
                    variant={'secondary'}
                    icon={'times'}
                    onClick={() => removeTag(tag.id)}
                    title={'Remove tag'}
                  />
                  <span className={styles.addTag}>
                    {search?.tags?.length && i === search.tags.length - 1 && (
                      <AccessoryButton variant={'secondary'} icon={'plus'} onClick={addTag} title={'Add tag'} />
                    )}
                  </span>
                </HorizontalGroup>
              </div>
            ))}
          </div>
        </InlineField>
      </InlineFieldRow>

      <TracePageSearchBar
        search={search}
        searchMatches={searchMatches}
        focusedSearchMatch={focusedSearchMatch}
        setFocusedSearchMatch={setFocusedSearchMatch}
        // datasourceType={datasourceType}
      />
    </Collapse>
  );
});

SpanFilters.displayName = 'SpanFilters';

const getStyles = () => {
  return {
    addTag: css`
      margin: 0 0 0 10px;
    `,
  };
};
