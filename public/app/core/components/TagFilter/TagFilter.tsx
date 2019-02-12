import React from 'react';
import { NoOptionsMessage, IndicatorsContainer, resetSelectStyles } from '@grafana/ui';
import AsyncSelect from '@torkelo/react-select/lib/Async';

import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';
import { components } from '@torkelo/react-select';
import { escapeStringForRegex } from '../FilterInput/FilterInput';

export interface Props {
  tags: string[];
  tagOptions: () => any;
  onChange: (tags: string[]) => void;
}

export class TagFilter extends React.Component<Props, any> {
  inlineTags: boolean;

  constructor(props) {
    super(props);
  }

  onLoadOptions = query => {
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
      getOptionValue: i => i.value,
      getOptionLabel: i => i.label,
      value: tags,
      styles: resetSelectStyles(),
      filterOption: (option, searchQuery) => {
        const regex = RegExp(escapeStringForRegex(searchQuery), 'i');
        return regex.test(option.value);
      },
      components: {
        Option: TagOption,
        IndicatorsContainer,
        NoOptionsMessage,
        MultiValueLabel: () => {
          return null; // We want the whole tag to be clickable so we use MultiValueRemove instead
        },
        MultiValueRemove: props => {
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
