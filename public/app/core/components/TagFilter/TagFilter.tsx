// Libraries
import React from 'react';
// @ts-ignore
import { components } from '@torkelo/react-select';
// @ts-ignore
import AsyncSelect from '@torkelo/react-select/async';
import { escapeStringForRegex } from '@grafana/data';
// Components
import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';
import { IndicatorsContainer, NoOptionsMessage, resetSelectStyles } from '@grafana/ui';

export interface TermCount {
  term: string;
  count: number;
}

export interface Props {
  tags: string[];
  tagOptions: () => Promise<TermCount[]>;
  onChange: (tags: string[]) => void;
}

export class TagFilter extends React.Component<Props, any> {
  inlineTags: boolean;

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
    this.props.onChange(newTags.map(tag => tag.value));
  };

  render() {
    const tags = this.props.tags.map(tag => ({ value: tag, label: tag, count: 0 }));

    const selectOptions = {
      classNamePrefix: 'gf-form-select-box',
      isMulti: true,
      defaultOptions: true,
      loadOptions: this.onLoadOptions,
      onChange: this.onChange,
      className: 'gf-form-input gf-form-input--form-dropdown',
      placeholder: 'Tags',
      loadingMessage: () => 'Loading...',
      noOptionsMessage: () => 'No tags found',
      getOptionValue: (i: any) => i.value,
      getOptionLabel: (i: any) => i.label,
      value: tags,
      styles: resetSelectStyles(),
      filterOption: (option: any, searchQuery: string) => {
        const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
        return regex.test(option.value);
      },
      components: {
        Option: TagOption,
        IndicatorsContainer,
        NoOptionsMessage,
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
      },
    };

    return (
      <div className="gf-form gf-form--has-input-icon gf-form--grow">
        <div className="tag-filter">
          <AsyncSelect {...selectOptions} />
        </div>
        <i className="gf-form-input-icon fa fa-tag" />
      </div>
    );
  }
}
