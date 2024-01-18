import debounce from 'debounce-promise';
import { has, size } from 'lodash';
import React, { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import {
  Select,
  InlineFormLabel,
  Icon,
  clearButtonStyles,
  useStyles2,
  AsyncSelect,
  Stack,
  InlineLabel,
} from '@grafana/ui';

import { OpenTsdbQuery } from '../types';

export interface TagSectionProps {
  query: OpenTsdbQuery;
  onChange: (query: OpenTsdbQuery) => void;
  onRunQuery: () => void;
  suggestTagKeys: (query: OpenTsdbQuery) => Promise<string[]>;
  suggestTagValues: (value: string) => Promise<SelectableValue[]>;
  tsdbVersion: number;
}

export function TagSection({
  query,
  onChange,
  onRunQuery,
  suggestTagKeys,
  suggestTagValues,
  tsdbVersion,
}: TagSectionProps) {
  const buttonStyles = useStyles2(clearButtonStyles);

  const [tagKeys, updTagKeys] = useState<Array<SelectableValue<string>>>();
  const [keyIsLoading, updKeyIsLoading] = useState<boolean>();

  const [addTagMode, updAddTagMode] = useState<boolean>(false);

  const [curTagKey, updCurTagKey] = useState<string | number>('');
  const [curTagValue, updCurTagValue] = useState<string>('');

  const [errors, setErrors] = useState<string>('');

  function changeAddTagMode() {
    updAddTagMode(!addTagMode);
  }

  function addTag() {
    if (query.filters && size(query.filters) > 0) {
      const err = 'Please remove filters to use tags, tags and filters are mutually exclusive.';
      setErrors(err);
      return;
    }

    if (!addTagMode) {
      updAddTagMode(true);
      return;
    }

    // check for duplicate tags
    if (query.tags && has(query.tags, curTagKey)) {
      const err = "Duplicate tag key '" + curTagKey + "'.";
      setErrors(err);
      return;
    }

    // tags may be undefined
    if (!query.tags) {
      query.tags = {};
    }

    // add tag to query
    query.tags[curTagKey] = curTagValue;

    // reset the inputs
    updCurTagKey('');
    updCurTagValue('');

    // fire the query
    onChange(query);
    onRunQuery();

    // close the tag ditor
    changeAddTagMode();
  }

  function removeTag(key: string | number) {
    delete query.tags[key];

    // fire off the query
    onChange(query);
    onRunQuery();
  }

  function editTag(key: string | number, value: string) {
    removeTag(key);
    updCurTagKey(key);
    updCurTagValue(value);
    addTag();
  }

  const tagValueSearch = debounce((query: string) => suggestTagValues(query), 350);

  return (
    <Stack gap={0} data-testid={testIds.section}>
      <InlineFormLabel
        className="query-keyword"
        width={8}
        tooltip={tsdbVersion >= 2 ? <div>Please use filters, tags are deprecated in opentsdb 2.2</div> : undefined}
      >
        Tags
      </InlineFormLabel>
      {query.tags &&
        Object.keys(query.tags).map((tagKey: string | number, idx: number) => {
          const tagValue = query.tags[tagKey];
          return (
            <InlineFormLabel key={idx} width="auto" data-testid={testIds.list + idx}>
              {tagKey}={tagValue}
              <button type="button" className={buttonStyles} onClick={() => editTag(tagKey, tagValue)}>
                <Icon name={'pen'} />
              </button>
              <button
                type="button"
                className={buttonStyles}
                onClick={() => removeTag(tagKey)}
                data-testid={testIds.remove}
              >
                <Icon name={'times'} />
              </button>
            </InlineFormLabel>
          );
        })}
      {!addTagMode && (
        <InlineFormLabel width={2}>
          <button type="button" className={buttonStyles} onClick={changeAddTagMode} aria-label="Add tag">
            <Icon name={'plus'} />
          </button>
        </InlineFormLabel>
      )}

      {addTagMode && (
        <Stack gap={0.5} alignItems="center">
          <Stack gap={0}>
            <Select
              inputId="opentsdb-suggested-tagk-select"
              value={curTagKey ? toOption('' + curTagKey) : undefined}
              placeholder="key"
              allowCustomValue
              onOpenMenu={async () => {
                updKeyIsLoading(true);
                const tKs = await suggestTagKeys(query);
                const tKsOptions = tKs.map((value: string) => toOption(value));
                updTagKeys(tKsOptions);
                updKeyIsLoading(false);
              }}
              isLoading={keyIsLoading}
              options={tagKeys}
              onChange={({ value }) => {
                if (value) {
                  updCurTagKey(value);
                }
              }}
            />
          </Stack>

          <Stack gap={0}>
            <AsyncSelect
              inputId="opentsdb-suggested-tagv-select"
              value={curTagValue ? toOption(curTagValue) : undefined}
              placeholder="value"
              allowCustomValue
              loadOptions={tagValueSearch}
              defaultOptions={[]}
              onChange={({ value }) => {
                if (value) {
                  updCurTagValue(value);
                }
              }}
            />
          </Stack>

          <Stack gap={0}>
            {errors && (
              <InlineLabel title={errors} data-testid={testIds.error}>
                <Icon name={'exclamation-triangle'} color={'rgb(229, 189, 28)'} />
              </InlineLabel>
            )}

            <InlineFormLabel width={5.5}>
              <button type="button" className={buttonStyles} onClick={addTag}>
                add tag
              </button>
              <button type="button" className={buttonStyles} onClick={changeAddTagMode}>
                <Icon name={'times'} />
              </button>
            </InlineFormLabel>
          </Stack>
        </Stack>
      )}
      <Stack gap={0} grow={1}>
        <InlineLabel> </InlineLabel>
      </Stack>
    </Stack>
  );
}

export const testIds = {
  section: 'opentsdb-tag',
  list: 'opentsdb-tag-list',
  error: 'opentsdb-tag-error',
  remove: 'opentsdb-tag-remove',
};
