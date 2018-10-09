import _ from 'lodash';
import React from 'react';
import AsyncSelect from 'react-select/lib/Async';
import { TagValue } from './TagValue';
import { TagOption } from './TagOption';
import { TagBadge } from './TagBadge';
import IndicatorsContainer from 'app/core/components/Picker/IndicatorsContainer';
import NoOptionsMessage from 'app/core/components/Picker/NoOptionsMessage';
import { components } from 'react-select';
import ResetStyles from 'app/core/components/Picker/ResetStyles';

export interface Props {
  tags: string[];
  tagOptions: () => any;
  onSelect: (tag: string) => void;
}

export class TagFilter extends React.Component<Props, any> {
  inlineTags: boolean;

  constructor(props) {
    super(props);

    this.searchTags = this.searchTags.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onTagRemove = this.onTagRemove.bind(this);
  }

  searchTags(query) {
    return this.props.tagOptions().then(options => {
      return options.map(option => ({
        value: option.term,
        label: option.term,
        count: option.count,
      }));
    });
  }

  onChange(newTags) {
    this.props.onSelect(newTags);
  }

  onTagRemove(tag) {
    let newTags = _.without(this.props.tags, tag.label);
    newTags = _.map(newTags, tag => {
      return { value: tag };
    });
    this.props.onSelect(newTags);
  }

  render() {
    const selectOptions = {
      classNamePrefix: 'gf-form-select2',
      isMulti: true,
      defaultOptions: true,
      loadOptions: this.searchTags,
      onChange: this.onChange,
      className: 'gf-form-input gf-form-input--form-dropdown',
      placeholder: 'Tags',
      loadingMessage: () => 'Loading...',
      noOptionsMessage: () => 'No tags found',
      getOptionValue: i => i.value,
      getOptionLabel: i => i.label,
      styles: ResetStyles,
      components: {
        Option: TagOption,
        IndicatorsContainer,
        NoOptionsMessage,
        MultiValueContainer: props => {
          const { data } = props;
          return (
            <components.MultiValueContainer {...props}>
              <TagBadge label={data.label} removeIcon={true} count={data.count} />
            </components.MultiValueContainer>
          );
        },
        MultiValueRemove: props => {
          return <components.MultiValueRemove {...props}>X</components.MultiValueRemove>;
        },
      },
    };

    // <AsyncSelect
    // classNamePrefix={`gf-form-select2`}
    // isMulti={false}
    // isLoading={isLoading}
    // defaultOptions={true}
    // loadOptions={this.debouncedSearch}
    // onChange={onSelected}
    // className={`gf-form-input gf-form-input--form-dropdown ${className || ''}`}
    // styles={ResetStyles}
    // components={{
    //   Option: PickerOption,
    //   IndicatorsContainer,
    //   NoOptionsMessage,
    // }}
    // placeholder="Select user"
    // filterOption={(option: { label: string }, searchText?: string) => {
    //   return option.label.includes(searchText);
    // }}
    // loadingMessage={() => 'Loading...'}
    // noOptionsMessage={() => 'No users found'}
    // getOptionValue={i => i.id}
    // getOptionLabel={i => i.label}

    selectOptions['valueComponent'] = TagValue;

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
