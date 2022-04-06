import React, { FC, useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { components } from 'react-select';
import debounce from 'debounce-promise';
import { Icon, AsyncMultiSelect, useStyles2 } from '@grafana/ui';
import { escapeStringForRegex, GrafanaTheme2 } from '@grafana/data';

import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';

export interface TermCount {
  term: string;
  count: number;
}

interface TagSelectOption {
  value: string;
  label: string;
  count: number;
}

export interface Props {
  allowCustomValue?: boolean;
  formatCreateLabel?: (input: string) => string;
  /** Do not show selected values inside Select. Useful when the values need to be shown in some other components */
  hideValues?: boolean;
  updateOptionsDynamically?: boolean;
  inputId?: string;
  isClearable?: boolean;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  tagOptions: () => Promise<TermCount[]>;
  tags: string[];
  width?: number;
}

const filterOption = (option: any, searchQuery: string) => {
  const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
  return regex.test(option.value);
};

export const TagFilter: FC<Props> = ({
  allowCustomValue = false,
  formatCreateLabel,
  hideValues,
  updateOptionsDynamically,
  inputId,
  isClearable,
  onChange,
  placeholder = 'Filter by tag',
  tagOptions,
  tags,
  width,
}) => {
  const styles = useStyles2(getStyles);

  const currentlySelectedTags = tags.map((tag) => ({ value: tag, label: tag, count: 0 }));
  const [options, setOptions] = useState<TagSelectOption[]>(currentlySelectedTags);
  const [isLoading, setIsLoading] = useState(false);
  const [selectKey, setSelectKey] = useState<string>(JSON.stringify(tags));
  const [previousTags, setPreviousTags] = useState(tags);

  useEffect(() => {
    if (updateOptionsDynamically && previousTags !== tags) {
      setPreviousTags(tags);
      // Slight delay necessary to ensure query results are most up to date
      // Key switching approach seems to be best way to ensure consistent update of tag options
      setTimeout(() => setSelectKey(JSON.stringify(tags)), 100);
    }
  }, [previousTags, tags, updateOptionsDynamically]);

  const onLoadOptions = async () => {
    const options = await tagOptions();
    return options.map((option) => ({
      value: option.term,
      label: option.term,
      count: option.count,
    }));
  };

  const debouncedLoadOptions = debounce(onLoadOptions, 300);

  const onTagChange = (newTags: any[]) => {
    // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
    // https://github.com/JedWatson/react-select/issues/3632
    onChange((newTags || []).map((tag) => tag.value));
  };

  const onFocus = async () => {
    setIsLoading(true);
    const results = await onLoadOptions();
    setOptions(results);
    setIsLoading(false);
  };

  const selectOptions = {
    ...(updateOptionsDynamically && { onFocus, isLoading, options, key: selectKey }),
    ...(!updateOptionsDynamically && { loadOptions: debouncedLoadOptions }),
    allowCreateWhileLoading: true,
    allowCustomValue,
    formatCreateLabel,
    defaultOptions: true,
    filterOption,
    getOptionLabel: (i: any) => i.label,
    getOptionValue: (i: any) => i.value,
    inputId,
    isMulti: true,
    loadingMessage: 'Loading...',
    noOptionsMessage: 'No tags found',
    onChange: onTagChange,
    placeholder,
    value: currentlySelectedTags,
    width,
    components: {
      Option: TagOption,
      MultiValueLabel: (): any => {
        return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
      },
      MultiValueRemove(props: any) {
        const { data } = props;

        return (
          <components.MultiValueRemove {...props}>
            <TagBadge key={data.label} label={data.label} removeIcon={true} count={data.count} />
          </components.MultiValueRemove>
        );
      },
      MultiValueContainer: hideValues ? (): any => null : components.MultiValueContainer,
    },
  };

  return (
    <div className={styles.tagFilter}>
      {isClearable && tags.length > 0 && (
        <span className={styles.clear} onClick={() => onTagChange([])}>
          Clear tags
        </span>
      )}
      <AsyncMultiSelect menuShouldPortal {...selectOptions} prefix={<Icon name="tag-alt" />} aria-label="Tag filter" />
    </div>
  );
};

TagFilter.displayName = 'TagFilter';

const getStyles = (theme: GrafanaTheme2) => ({
  tagFilter: css`
    position: relative;
    min-width: 180px;
    flex-grow: 1;

    .label-tag {
      margin-left: 6px;
      cursor: pointer;
    }
  `,
  clear: css`
    text-decoration: underline;
    font-size: 12px;
    position: absolute;
    top: -22px;
    right: 0;
    cursor: pointer;
    color: ${theme.colors.text.secondary};

    &:hover {
      color: ${theme.colors.text.primary};
    }
  `,
});
