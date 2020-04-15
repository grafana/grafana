// Libraries
import React from 'react';
// @ts-ignore
import { components } from '@torkelo/react-select';
import { AsyncSelect } from '@grafana/ui';
import { resetSelectStyles, Icon } from '@grafana/ui';
import { FormInputSize } from '@grafana/ui/src/components/Forms/types';
import { escapeStringForRegex } from '@grafana/data';
// Components
import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';

export interface TermCount {
  term: string;
  count: number;
}

export interface Props {
  tags: string[];
  tagOptions: () => Promise<TermCount[]>;
  onChange: (tags: string[]) => void;
  size?: FormInputSize;
  placeholder?: string;
  /** Do not show selected values inside Select. Useful when the values need to be shown in some other components */
  hideValues?: boolean;
}

export class TagFilter extends React.Component<Props, any> {
  static defaultProps = {
    size: 'auto',
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
    const tags = this.props.tags.map(tag => ({ value: tag, label: tag, count: 0 }));
    const { size, placeholder, hideValues } = this.props;

    const selectOptions = {
      defaultOptions: true,
      getOptionLabel: (i: any) => i.label,
      getOptionValue: (i: any) => i.value,
      isMulti: true,
      loadOptions: this.onLoadOptions,
      loadingMessage: 'Loading...',
      noOptionsMessage: 'No tags found',
      onChange: this.onChange,
      placeholder,
      size,
      styles: resetSelectStyles(),
      value: tags,
      filterOption: (option: any, searchQuery: string) => {
        const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
        return regex.test(option.value);
      },
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
      <div className="tag-filter">
        <AsyncSelect {...selectOptions} prefix={<Icon name="tag-alt" />} />
      </div>
    );
  }
}
