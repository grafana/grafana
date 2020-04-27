// Libraries
import React from 'react';
import { css } from 'emotion';
// @ts-ignore
import { components } from '@torkelo/react-select';
import { AsyncSelect, stylesFactory } from '@grafana/ui';
import { Icon } from '@grafana/ui';
import { escapeStringForRegex } from '@grafana/data';
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

export class TagFilter extends React.Component<Props, any> {
  static defaultProps = {
    placeholder: 'Tags',
  };

  constructor(props: Props) {
    super(props);
  }

  onLoadOptions = (query: string) => {
    return this.props.tagOptions().then(options => {
      return options.map(option => ({
        value: option.term,
        label: option.term,
        count: option.count,
      }));
    });
  };

  onChange = (newTags: any[]) => {
    // On remove with 1 item returns null, so we need to make sure it's an empty array in that case
    // https://github.com/JedWatson/react-select/issues/3632
    this.props.onChange((newTags || []).map(tag => tag.value));
  };

  render() {
    const styles = getStyles();

    const tags = this.props.tags.map(tag => ({ value: tag, label: tag, count: 0 }));
    const { width, placeholder, hideValues, isClearable } = this.props;

    const selectOptions = {
      defaultOptions: true,
      filterOption,
      getOptionLabel: (i: any) => i.label,
      getOptionValue: (i: any) => i.value,
      isClearable,
      isMulti: true,
      loadOptions: this.onLoadOptions,
      loadingMessage: 'Loading...',
      noOptionsMessage: 'No tags found',
      onChange: this.onChange,
      placeholder,
      value: tags,
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
      <div className={styles.tagFilter}>
        <AsyncSelect {...selectOptions} prefix={<Icon name="tag-alt" />} />
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  return {
    tagFilter: css`
      min-width: 180px;
      flex-grow: 1;

      .label-tag {
        margin-left: 6px;
        cursor: pointer;
      }
    `,
  };
});
