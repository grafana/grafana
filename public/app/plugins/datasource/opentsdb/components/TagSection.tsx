import debounce from 'debounce-promise';
import { has, size } from 'lodash';
import React, { useState } from 'react';

import { SelectableValue, toOption } from '@grafana/data';
import { Select, InlineFormLabel, Icon, clearButtonStyles, useStyles2, AsyncSelect } from '@grafana/ui';

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
    <div className="gf-form-inline" data-testid={testIds.section}>
      <div className="gf-form">
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
          <button className="gf-form-label" type="button" onClick={changeAddTagMode} aria-label="Add tag">
            <Icon name={'plus'} />
          </button>
        )}
      </div>
      {addTagMode && (
        <div className="gf-form-inline">
          <div className="gf-form">
            <Select
              inputId="opentsdb-suggested-tagk-select"
              className="gf-form-input"
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
          </div>

          <div className="gf-form">
            <AsyncSelect
              inputId="opentsdb-suggested-tagv-select"
              className="gf-form-input"
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
          </div>

          <div className="gf-form">
            {errors && (
              <div className="gf-form-label" title={errors} data-testid={testIds.error}>
                <Icon name={'exclamation-triangle'} color={'rgb(229, 189, 28)'} />
              </div>
            )}

            <div className="gf-form-label">
              <button type="button" className={buttonStyles} onClick={addTag}>
                add tag
              </button>
              <button type="button" className={buttonStyles} onClick={changeAddTagMode}>
                <Icon name={'times'} />
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="gf-form gf-form--grow">
        <div className="gf-form-label gf-form-label--grow"></div>
      </div>
    </div>
  );
}

export const testIds = {
  section: 'opentsdb-tag',
  list: 'opentsdb-tag-list',
  error: 'opentsdb-tag-error',
  remove: 'opentsdb-tag-remove',
};
