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
import React, { useState, memo } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import {
  Collapse,
  HorizontalGroup,
  Icon,
  InlineField,
  InlineFieldRow,
  Input,
  Select,
  Tooltip,
  useStyles2,
} from '@grafana/ui';

import { randomId, SearchProps } from '../../../useSearch';
import { Trace } from '../../types';
import NewTracePageSearchBar from '../NewTracePageSearchBar';

export type SpanFilterProps = {
  trace: Trace;
  search: SearchProps;
  showSpanFilters: boolean;
  setShowSpanFilters: (isOpen: boolean) => void;
  setSearch: React.Dispatch<React.SetStateAction<SearchProps>>;
  spanFilterMatches: Set<string> | undefined;
  focusedSpanIdForSearch: string;
  setFocusedSpanIdForSearch: React.Dispatch<React.SetStateAction<string>>;
  datasourceType: string;
};

export const SpanFilters = memo((props: SpanFilterProps) => {
  const {
    trace,
    showSpanFilters,
    setShowSpanFilters,
    search,
    setSearch,
    spanFilterMatches,
    focusedSpanIdForSearch,
    setFocusedSpanIdForSearch,
    datasourceType,
  } = props;
  const styles = { ...useStyles2(getStyles) };
  const [serviceNames, setServiceNames] = useState<Array<SelectableValue<string>>>();
  const [spanNames, setSpanNames] = useState<Array<SelectableValue<string>>>();
  const [tagKeys, setTagKeys] = useState<Array<SelectableValue<string>>>();
  const [tagValues, setTagValues] = useState<{ [key: string]: Array<SelectableValue<string>> }>({});

  if (!trace) {
    return null;
  }

  const getServiceNames = () => {
    if (!serviceNames) {
      const serviceNames = trace.spans.map((span) => {
        return span.process.serviceName;
      });
      setServiceNames(
        uniq(serviceNames)
          .sort()
          .map((name) => {
            return toOption(name);
          })
      );
    }
  };

  const getSpanNames = () => {
    if (!spanNames) {
      const spanNames = trace.spans.map((span) => {
        return span.operationName;
      });
      setSpanNames(
        uniq(spanNames)
          .sort()
          .map((name) => {
            return toOption(name);
          })
      );
    }
  };

  const getTagKeys = () => {
    if (!tagKeys) {
      const keys: string[] = [];

      trace.spans.forEach((span) => {
        span.tags.forEach((tag) => {
          keys.push(tag.key);
        });
        span.process.tags.forEach((tag) => {
          keys.push(tag.key);
        });
        if (span.logs !== null) {
          span.logs.forEach((log) => {
            log.fields.forEach((field) => {
              keys.push(field.key);
            });
          });
        }
      });

      setTagKeys(
        uniq(keys)
          .sort()
          .map((name) => {
            return toOption(name);
          })
      );
    }
  };

  const getTagValues = async (key: string) => {
    const values: string[] = [];

    trace.spans.forEach((span) => {
      const tagValue = span.tags.find((t) => t.key === key)?.value;
      if (tagValue) {
        values.push(tagValue.toString());
      }
      const processTagValue = span.process.tags.find((t) => t.key === key)?.value;
      if (processTagValue) {
        values.push(processTagValue.toString());
      }
      if (span.logs !== null) {
        span.logs.forEach((log) => {
          const logsTagValue = log.fields.find((t) => t.key === key)?.value;
          if (logsTagValue) {
            values.push(logsTagValue.toString());
          }
        });
      }
    });

    return uniq(values)
      .sort()
      .map((name) => {
        return toOption(name);
      });
  };

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

  const collapseLabel = (
    <Tooltip
      content="Filter your spans below. The more filters, the more specific the filtered spans."
      placement="right"
    >
      <span id="collapse-label">
        Span Filters
        <Icon size="sm" name="info-circle" />
      </span>
    </Tooltip>
  );

  return (
    <div className={styles.container}>
      <Collapse label={collapseLabel} collapsible={true} isOpen={showSpanFilters} onToggle={setShowSpanFilters}>
        <InlineFieldRow>
          <InlineField label="Service Name" labelWidth={16}>
            <HorizontalGroup spacing={'xs'}>
              <Select
                aria-label="Select service name operator"
                onChange={(v) => setSearch({ ...search, serviceNameOperator: v.value! })}
                options={[toOption('='), toOption('!=')]}
                value={search.serviceNameOperator}
              />
              <Select
                aria-label="Select service name"
                isClearable
                onChange={(v) => setSearch({ ...search, serviceName: v?.value || '' })}
                onOpenMenu={getServiceNames}
                options={serviceNames}
                placeholder="All service names"
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Span Name" labelWidth={16}>
            <HorizontalGroup spacing={'xs'}>
              <Select
                aria-label="Select span name operator"
                onChange={(v) => setSearch({ ...search, spanNameOperator: v.value! })}
                options={[toOption('='), toOption('!=')]}
                value={search.spanNameOperator}
              />
              <Select
                aria-label="Select span name"
                isClearable
                onChange={(v) => setSearch({ ...search, spanName: v?.value || '' })}
                onOpenMenu={getSpanNames}
                options={spanNames}
                placeholder="All span names"
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Duration" labelWidth={16}>
            <HorizontalGroup spacing={'xs'}>
              <Select
                aria-label="Select from operator"
                onChange={(v) => setSearch({ ...search, fromOperator: v.value! })}
                options={[toOption('>'), toOption('>=')]}
                value={search.fromOperator}
              />
              <Input
                aria-label="Select from value"
                onChange={(v) => setSearch({ ...search, from: v.currentTarget.value })}
                placeholder="e.g. 100ms, 1.2s"
                value={search.from || ''}
                width={18}
              />
              <Select
                aria-label="Select to operator"
                onChange={(v) => setSearch({ ...search, toOperator: v.value! })}
                options={[toOption('<'), toOption('<=')]}
                value={search.toOperator}
              />
              <Input
                aria-label="Select to value"
                onChange={(v) => setSearch({ ...search, to: v.currentTarget.value })}
                placeholder="e.g. 100ms, 1.2s"
                value={search.to || ''}
                width={18}
              />
            </HorizontalGroup>
          </InlineField>
        </InlineFieldRow>
        <InlineFieldRow>
          <InlineField label="Tags" labelWidth={16} tooltip="Filter by tags, process tags or log fields in your spans.">
            <div>
              {search.tags.map((tag, i) => (
                <div key={i}>
                  <HorizontalGroup spacing={'xs'} width={'auto'}>
                    <Select
                      aria-label={`Select tag key`}
                      isClearable
                      key={tag.key}
                      onChange={(v) => {
                        setSearch({
                          ...search,
                          tags: search.tags?.map((x) => {
                            return x.id === tag.id ? { ...x, key: v?.value || '', value: undefined } : x;
                          }),
                        });

                        const loadTagValues = async () => {
                          if (v?.value) {
                            setTagValues({
                              ...tagValues,
                              [tag.id]: await getTagValues(v.value),
                            });
                          } else {
                            // removed value
                            const updatedValues = { ...tagValues };
                            if (updatedValues[tag.id]) {
                              delete updatedValues[tag.id];
                            }
                            setTagValues(updatedValues);
                          }
                        };
                        loadTagValues();
                      }}
                      onOpenMenu={getTagKeys}
                      options={tagKeys}
                      placeholder="Select tag"
                      value={tag.key}
                    />
                    <Select
                      aria-label={`Select tag operator`}
                      onChange={(v) => {
                        setSearch({
                          ...search,
                          tags: search.tags?.map((x) => {
                            return x.id === tag.id ? { ...x, operator: v.value! } : x;
                          }),
                        });
                      }}
                      options={[toOption('='), toOption('!=')]}
                      value={tag.operator}
                    />
                    <span className={styles.tagValues}>
                      <Select
                        aria-label={`Select tag value`}
                        isClearable
                        key={tag.value}
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
                      aria-label={`Remove tag`}
                      variant={'secondary'}
                      icon={'times'}
                      onClick={() => removeTag(tag.id)}
                      title={'Remove tag'}
                    />
                    <span className={styles.addTag}>
                      {search?.tags?.length && i === search.tags.length - 1 && (
                        <AccessoryButton
                          aria-label="Add tag"
                          variant={'secondary'}
                          icon={'plus'}
                          onClick={addTag}
                          title={'Add tag'}
                        />
                      )}
                    </span>
                  </HorizontalGroup>
                </div>
              ))}
            </div>
          </InlineField>
        </InlineFieldRow>

        <NewTracePageSearchBar
          search={search}
          setSearch={setSearch}
          spanFilterMatches={spanFilterMatches}
          focusedSpanIdForSearch={focusedSpanIdForSearch}
          setFocusedSpanIdForSearch={setFocusedSpanIdForSearch}
          datasourceType={datasourceType}
        />
      </Collapse>
    </div>
  );
});

SpanFilters.displayName = 'SpanFilters';

const getStyles = () => {
  return {
    container: css`
      margin: 0.5em 0 -8px 0;
      position: sticky;
      top: -13.5em;
      z-index: 5;

      & > div {
        border-left: none;
        border-right: none;
      }

      #collapse-label svg {
        margin: -1px 0 0 10px;
      }
    `,
    addTag: css`
      margin: 0 0 0 10px;
    `,
    tagValues: css`
      max-width: 200px;
    `,
  };
};
