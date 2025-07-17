import { css } from '@emotion/css';
import React from 'react';
import { useMount } from 'react-use';

import { GrafanaTheme2, SelectableValue, toOption, TraceSearchProps, TraceSearchTag } from '@grafana/data';
import { t } from '@grafana/i18n';
import { AccessoryButton } from '@grafana/plugin-ui';
import { Input, Select, Stack, useStyles2 } from '@grafana/ui';

import { randomId } from '../../../../state/constants';
import { getTraceTagKeys, getTraceTagValues } from '../../../utils/tags';
import { Trace } from '../../types/trace';

interface Props {
  search: TraceSearchProps;
  setSearch: (search: TraceSearchProps) => void;
  trace: Trace;
  tagKeys?: Array<SelectableValue<string>>;
  setTagKeys: React.Dispatch<React.SetStateAction<Array<SelectableValue<string>> | undefined>>;
  tagValues: Record<string, Array<SelectableValue<string>>>;
  setTagValues: React.Dispatch<React.SetStateAction<{ [key: string]: Array<SelectableValue<string>> }>>;
}

export const SpanFiltersTags = ({ search, trace, setSearch, tagKeys, setTagKeys, tagValues, setTagValues }: Props) => {
  const styles = { ...useStyles2(getStyles) };

  const getTagKeys = () => {
    if (!tagKeys) {
      setTagKeys(getTraceTagKeys(trace).map(toOption));
    }
  };

  const getTagValues = (key: string) => {
    return getTraceTagValues(trace, key).map(toOption);
  };

  useMount(() => {
    if (search.tags) {
      search.tags.forEach((tag) => {
        if (tag.key) {
          setTagValues({
            ...tagValues,
            [tag.id]: getTagValues(tag.key),
          });
        }
      });
    }
  });

  const onTagChange = (tag: TraceSearchTag, v: SelectableValue<string>) => {
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
          [tag.id]: getTagValues(v.value),
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

  return (
    <div>
      {search.tags?.map((tag, i) => (
        <div key={tag.id}>
          <Stack gap={0} width={'auto'} justifyContent={'flex-start'} alignItems={'center'}>
            <div>
              <Select
                aria-label={t('explore.span-filters-tags.aria-label-select-tag-key', 'Select tag key')}
                isClearable
                key={tag.key}
                onChange={(v) => onTagChange(tag, v)}
                onOpenMenu={getTagKeys}
                options={tagKeys || (tag.key ? [tag.key].map(toOption) : [])}
                placeholder={t('explore.span-filters-tags.placeholder-select-tag', 'Select tag')}
                value={tag.key || null}
              />
            </div>
            <div>
              <Select
                aria-label={t('explore.span-filters-tags.aria-label-select-tag-operator', 'Select tag operator')}
                onChange={(v) => {
                  setSearch({
                    ...search,
                    tags: search.tags?.map((x) => {
                      return x.id === tag.id ? { ...x, operator: v.value! } : x;
                    }),
                  });
                }}
                options={[toOption('='), toOption('!='), toOption('=~'), toOption('!~')]}
                value={tag.operator}
              />
            </div>

            <span className={styles.tagValues}>
              {(tag.operator === '=' || tag.operator === '!=') && (
                <Select
                  aria-label={t('explore.span-filters-tags.aria-label-select-tag-value', 'Select tag value')}
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
                  options={tagValues[tag.id] ? tagValues[tag.id] : tag.value ? [tag.value].map(toOption) : []}
                  placeholder={t('explore.span-filters-tags.placeholder-select-value', 'Select value')}
                  value={tag.value}
                />
              )}
              {(tag.operator === '=~' || tag.operator === '!~') && (
                <Input
                  aria-label={t('explore.span-filters-tags.aria-label-input-tag-value', 'Input tag value')}
                  onChange={(v) => {
                    setSearch({
                      ...search,
                      tags: search.tags?.map((x) => {
                        return x.id === tag.id ? { ...x, value: v?.currentTarget?.value || '' } : x;
                      }),
                    });
                  }}
                  placeholder={t('explore.span-filters-tags.placeholder-tag-value', 'Tag value')}
                  width={18}
                  value={tag.value || ''}
                />
              )}
            </span>
            {(tag.key || tag.value || search.tags.length > 1) && (
              <AccessoryButton
                aria-label={t('explore.span-filters-tags.aria-label-remove-tag', 'Remove tag')}
                variant="secondary"
                icon="times"
                onClick={() => removeTag(tag.id)}
                tooltip={t('explore.span-filters-tags.tooltip-remove-tag', 'Remove tag')}
              />
            )}
            {(tag.key || tag.value) && i === search.tags.length - 1 && (
              <span className={styles.addTag}>
                <AccessoryButton
                  aria-label={t('explore.span-filters-tags.aria-label-add-tag', 'Add tag')}
                  variant="secondary"
                  icon="plus"
                  onClick={addTag}
                  tooltip={t('explore.span-filters-tags.tooltip-add-tag', 'Add tag')}
                />
              </span>
            )}
          </Stack>
        </div>
      ))}
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  addTag: css({
    marginLeft: theme.spacing(1),
  }),
  tagValues: css({
    maxWidth: '200px',
  }),
});
