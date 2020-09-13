// Libraries
import React, { FC } from 'react';
import { css } from 'emotion';
// @ts-ignore
import { components } from '@torkelo/react-select';
import { AsyncSelect, stylesFactory, useTheme, resetSelectStyles, Icon } from '@grafana/ui';
import { escapeStringForRegex, GrafanaTheme } from '@grafana/data';
// Components
import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';

export interface TermCount {
  term: string;
  count: number;
}

export interface Props {
  /** Do not show selected values inside Select. Useful when the values need to be shown in some other components */
  hideValues?: boolean;
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
  hideValues,
  isClearable,
  onChange,
  placeholder = 'Filter by tag',
  tagOptions,
  tags,
  width,
}) => {
  const theme = useTheme();
  const styles = getStyles(theme);

  const onLoadOptions = (query: string) => {
    return tagOptions().then(options => {
      return options.map(option => ({
        value: option.term,
        label: option.term,
        count: option.count,
      }));
    });
  };

  const onTagChange = (newTags: any[]) => {
    // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
    // https://github.com/JedWatson/react-select/issues/3632
    onChange((newTags || []).map(tag => tag.value));
  };

  const value = tags.map(tag => ({ value: tag, label: tag, count: 0 }));

  const selectOptions = {
    defaultOptions: true,
    filterOption,
    getOptionLabel: (i: any) => i.label,
    getOptionValue: (i: any) => i.value,
    isMulti: true,
    loadOptions: onLoadOptions,
    loadingMessage: 'Loading...',
    noOptionsMessage: 'No tags found',
    onChange: onTagChange,
    placeholder,
    styles: resetSelectStyles(),
    value,
    width,
    components: {
      Option: TagOption,
      MultiValueLabel: (): any => {
        return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
      },
      MultiValueRemove: (props: any) => {
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
    <div className={styles.tagFilter} aria-label="Tag filter">
      {isClearable && tags.length > 0 && (
        <span className={styles.clear} onClick={() => onTagChange([])}>
          Clear tags
        </span>
      )}
      <AsyncSelect {...selectOptions} prefix={<Icon name="tag-alt" />} />
    </div>
  );
};

TagFilter.displayName = 'TagFilter';

const getStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
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
      color: ${theme.colors.textWeak};

      &:hover {
        color: ${theme.colors.textStrong};
      }
    `,
  };
});
