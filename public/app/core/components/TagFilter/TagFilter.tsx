import { css } from '@emotion/css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { components, MultiValueRemoveProps } from 'react-select';

import { escapeStringForRegex, GrafanaTheme2, SelectableValue } from '@grafana/data';
import { Icon, MultiSelect, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { TagBadge, getStyles as getTagBadgeStyles } from './TagBadge';
import { TagOption, TagSelectOption } from './TagOption';

export interface TermCount {
  term: string;
  count: number;
}

export interface Props {
  allowCustomValue?: boolean;
  formatCreateLabel?: (input: string) => string;
  /** Do not show selected values inside Select. Useful when the values need to be shown in some other components */
  hideValues?: boolean;
  inputId?: string;
  isClearable?: boolean;
  onChange: (tags: string[]) => void;
  placeholder?: string;
  tagOptions: () => Promise<TermCount[]>;
  tags: string[];
  width?: number;
}

const filterOption = (option: SelectableValue<string>, searchQuery: string) => {
  const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
  return Boolean(option.value && regex.test(option.value));
};

export const TagFilter = ({
  allowCustomValue = false,
  formatCreateLabel,
  hideValues,
  inputId,
  isClearable,
  onChange,
  placeholder,
  tagOptions,
  tags,
  width,
}: Props) => {
  const styles = useStyles2(getStyles);

  const currentlySelectedTags = tags.map((tag) => ({ value: tag, label: tag, count: 0 }));
  const [options, setOptions] = useState<TagSelectOption[]>(currentlySelectedTags);
  const [isLoading, setIsLoading] = useState(false);
  const [previousTags, setPreviousTags] = useState(tags);
  const [customTags, setCustomTags] = useState<TagSelectOption[]>(currentlySelectedTags);

  // Necessary to force re-render to keep tag options up to date / relevant
  const selectKey = useMemo(() => tags.join(), [tags]);

  const onLoadOptions = useCallback(async () => {
    const options = await tagOptions();
    return options.map((option) => {
      if (tags.includes(option.term)) {
        return {
          value: option.term,
          label: option.term,
          count: 0,
        };
      } else {
        return {
          value: option.term,
          label: option.term,
          count: option.count,
        };
      }
    });
  }, [tagOptions, tags]);

  const onFocus = useCallback(async () => {
    setIsLoading(true);
    const results = await onLoadOptions();

    if (allowCustomValue) {
      customTags.forEach((customTag) => results.push(customTag));
    }

    setOptions(results);
    setIsLoading(false);
  }, [allowCustomValue, customTags, onLoadOptions]);

  useEffect(() => {
    // Load options when tag is selected externally
    if (tags.length > 0 && options.length === 0) {
      onFocus();
    }
  }, [onFocus, options.length, tags.length]);

  useEffect(() => {
    // Update selected tags to not include (counts) when selected externally
    if (tags !== previousTags) {
      setPreviousTags(tags);
      onFocus();
    }
  }, [onFocus, previousTags, tags]);

  const onTagChange = (newTags: any[]) => {
    newTags.forEach((tag) => (tag.count = 0));

    // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
    // https://github.com/JedWatson/react-select/issues/3632
    onChange((newTags || []).map((tag) => tag.value));

    // If custom values are allowed, set custom tags to prevent overwriting from query update
    if (allowCustomValue) {
      setCustomTags(newTags.filter((tag) => !tags.includes(tag)));
    }
  };

  const selectOptions = {
    onFocus,
    isLoading,
    options,
    allowCreateWhileLoading: true,
    allowCustomValue,
    formatCreateLabel,
    defaultOptions: true,
    filterOption,
    getOptionLabel: (i: SelectableValue<string>) => i.label,
    getOptionValue: (i: SelectableValue<string>) => i.value,
    inputId,
    isMulti: true,
    onChange: onTagChange,
    loadingMessage: t('tag-filter.loading', 'Loading...'),
    noOptionsMessage: t('tag-filter.no-tags', 'No tags found'),
    placeholder: placeholder || t('tag-filter.placeholder', 'Filter by tag'),
    value: currentlySelectedTags,
    width,
    components: {
      Option: TagOption,
      MultiValueLabel: () => {
        return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
      },
      MultiValueRemove(props: MultiValueRemoveProps<TagSelectOption>) {
        const { data } = props;

        return (
          <components.MultiValueRemove {...props}>
            <TagBadge key={data.label} label={data.label} removeIcon={true} count={data.count} />
          </components.MultiValueRemove>
        );
      },
      MultiValueContainer: hideValues ? () => null : components.MultiValueContainer,
    },
  };

  return (
    <div className={styles.tagFilter}>
      {isClearable && tags.length > 0 && (
        <button className={styles.clear} onClick={() => onTagChange([])}>
          <Trans i18nKey="tag-filter.clear-button">Clear tags</Trans>
        </button>
      )}
      <MultiSelect key={selectKey} {...selectOptions} prefix={<Icon name="tag-alt" />} aria-label="Tag filter" />
    </div>
  );
};

TagFilter.displayName = 'TagFilter';

const getStyles = (theme: GrafanaTheme2) => {
  const tagBadgeStyles = getTagBadgeStyles(theme);

  return {
    tagFilter: css({
      position: 'relative',
      minWidth: '180px',
      flexGrow: 1,

      [`.${tagBadgeStyles.badge}`]: {
        marginLeft: '6px',
        cursor: 'pointer',
      },
    }),
    clear: css({
      background: 'none',
      border: 'none',
      textDecoration: 'underline',
      fontSize: '12px',
      padding: 'none',
      position: 'absolute',
      top: '-17px',
      right: 0,
      cursor: 'pointer',
      color: theme.colors.text.secondary,

      '&:hover': {
        color: theme.colors.text.primary,
      },
    }),
  };
};
