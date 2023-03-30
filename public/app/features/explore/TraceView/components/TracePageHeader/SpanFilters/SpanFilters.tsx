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
import { uniq } from 'lodash';
import * as React from 'react';
import { useEffect, useState } from 'react';
import { useToggle } from 'react-use';

import { SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { Collapse, HorizontalGroup, InlineField, InlineFieldRow, Input, Select, useStyles2 } from '@grafana/ui';

import { randomId, SearchProps } from '../../../useSearch';
import { Trace } from '../../types';
import TracePageSearchBar from '../TracePageSearchBar';

export type SpanFilterProps = {
  trace: Trace;
  search: SearchProps;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  searchMatches: Set<string> | undefined;
  focusedSearchMatch: string;
  setFocusedSearchMatch: React.Dispatch<React.SetStateAction<string>>;
  datasourceType: string;
};

interface SpanData {
  serviceNames: string[];
  spanNames: string[];
  tagKeys: string[];
}

export const SpanFilters = React.memo((props: SpanFilterProps) => {
  const { trace, search, setSearch, searchMatches, focusedSearchMatch, setFocusedSearchMatch, datasourceType } = props;
  const styles = { ...useStyles2(getStyles) };
  const [showSpanFilters, setShowSpanFilters] = useToggle(true);
  const [spanData, setSpanData] = useState<SpanData>({
    serviceNames: [],
    spanNames: [],
    tagKeys: [],
  });
  const [tagValues, setTagValues] = useState<{ [key: string]: Array<SelectableValue<string>> }>({});

  useEffect(() => {
    const serviceNames: string[] = [];
    const spanNames: string[] = [];
    const tagKeys: string[] = [];

    trace.spans.map((span) => {
      serviceNames.push(span.process.serviceName);
      spanNames.push(span.operationName);

      span.tags.map((tag) => {
        tagKeys.push(tag.key);
      });
      span.process.tags.map((tag) => {
        tagKeys.push(tag.key);
      });
      if (span.logs !== null) {
        span.logs.map((log) => {
          log.fields.map((field) => {
            tagKeys.push(field.key);
          });
        });
      }
    });

    const spanData = {
      serviceNames: uniq(serviceNames).sort(),
      spanNames: uniq(spanNames).sort(),
      tagKeys: uniq(tagKeys).sort(),
    };

    setSpanData(spanData);
  }, [trace]);

  const serviceNameOptions = () => {
    return spanData.serviceNames.map((name) => {
      return toOption(name);
    });
  };

  const spanNameOptions = () => {
    return spanData.spanNames.map((name) => {
      return toOption(name);
    });
  };

  const tagKeyOptions = () => {
    return spanData.tagKeys.map((name) => {
      return toOption(name);
    });
  };

  const tagValueOptions = (key: string | undefined) => {
    let values: string[] = [];

    if (key) {
      trace.spans.map((span) => {
        span.tags.map((tag) => {
          if (tag.key === key) {
            values.push(tag.value.toString());
          }
        });
        span.process.tags.map((tag) => {
          if (tag.key === key) {
            values.push(tag.value.toString());
          }
        });
        if (span.logs !== null) {
          span.logs.map((log) => {
            log.fields.map((field) => {
              if (field.key === key) {
                values.push(field.value.toString());
              }
            });
          });
        }
      });
    }

    return uniq(values)
      .sort()
      .map((name) => {
        return toOption(name);
      });
  };

  // keep tagValues in sync with tags that have selected keys
  // so only tags with keys will show values when select opened
  useEffect(() => {
    for (const key of Object.keys(tagValues)) {
      search.tags.map((tag) => {
        if (tag.id === key && tag.key === '') {
          delete tagValues[key];
          setTagValues(tagValues);
        }
      });
    }
  }, [search.tags, tagValues]);

  const addTag = () => {
    const tag = {
      id: randomId(),
      operator: '=',
    };
    setSearch({ ...search, tags: [...search.tags, tag] });
  };

  const removeTag = (id: string) => {
    let tags = search.tags.filter((tag) => {
      return tag.id !== id;
    });
    if (tags.length === 0) {
      tags = [
        {
          id: randomId(),
          operator: '=',
        },
      ];
    }
    setSearch({ ...search, tags: tags });
  };

  if (!trace) {
    return null;
  }

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
              onChange={(v) => setSearch({ ...search, serviceName: v?.value || '' })}
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
        <InlineField label="Tags" labelWidth={16} tooltip="Filter by tags, process tags or log tags in your spans.">
          <div>
            {search.tags.map((tag, i) => (
              <div key={i}>
                <HorizontalGroup spacing={'none'} width={'auto'}>
                  <Select
                    aria-label={`select tag-${tag.id} key`}
                    isClearable
                    onChange={(v) => {
                      setSearch({
                        ...search,
                        tags: search.tags?.map((x) => {
                          return x.id === tag.id ? { ...x, key: v?.value || '', value: undefined } : x;
                        }),
                      });

                      setTimeout(() => {
                        if (v?.value) {
                          setTagValues({
                            ...tagValues,
                            [tag.id]: tagValueOptions(v.value),
                          });
                        } else {
                          // removed value
                          const updatedValues = { ...tagValues };
                          if (updatedValues[tag.id]) {
                            delete updatedValues[tag.id];
                          }
                          setTagValues(updatedValues);
                        }
                      }, 20);
                    }}
                    options={tagKeyOptions()}
                    placeholder="Select tag"
                    value={tag.key}
                  />
                  <Select
                    onChange={(v) => {
                      setSearch({
                        ...search,
                        tags: search.tags?.map((x) => {
                          return x.id === tag.id ? { ...x, operator: v?.value || '=' } : x;
                        }),
                      });
                    }}
                    options={[toOption('='), toOption('!=')]}
                    value={tag.operator}
                  />
                  <span className={styles.tagValues}>
                    <Select
                      aria-label={`select tag-${tag.id} value`}
                      isClearable
                      onChange={(v) => {
                        setSearch({
                          ...search,
                          tags: search.tags?.map((x) => {
                            return x.id === tag.id ? { ...x, value: v?.value || '' } : x;
                          }),
                        });
                      }}
                      options={tagValues[tag.id] ? tagValues[tag.id] : []}
                      placeholder="Select value"
                      value={tag.value}
                    />
                  </span>
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
        setSearch={setSearch}
        searchMatches={searchMatches}
        focusedSearchMatch={focusedSearchMatch}
        setFocusedSearchMatch={setFocusedSearchMatch}
        datasourceType={datasourceType}
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
    tagValues: css`
      max-width: 200px;
    `,
  };
};
