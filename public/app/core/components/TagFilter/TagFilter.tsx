import _ from 'lodash';
import React from 'react';
import { Async } from 'react-select';
import { TagValue } from './TagValue';
import { TagOption } from './TagOption';

export interface IProps {
  tags: string[];
  tagOptions: () => any;
  onSelect: (tag: string) => void;
}

export class TagFilter extends React.Component<IProps, any> {
  inlineTags: boolean;

  constructor(props) {
    super(props);

    this.searchTags = this.searchTags.bind(this);
    this.onChange = this.onChange.bind(this);
    this.onTagRemove = this.onTagRemove.bind(this);
  }

  searchTags(query) {
    return this.props.tagOptions().then(options => {
      const tags = _.map(options, tagOption => {
        return { value: tagOption.term, label: tagOption.term, count: tagOption.count };
      });
      return { options: tags };
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
    let selectOptions = {
      loadOptions: this.searchTags,
      onChange: this.onChange,
      value: this.props.tags,
      multi: true,
      className: 'gf-form-input gf-form-input--form-dropdown',
      placeholder: 'Tags',
      loadingPlaceholder: 'Loading...',
      noResultsText: 'No tags found',
      optionComponent: TagOption,
    };

    selectOptions['valueComponent'] = TagValue;

    return (
      <div className="gf-form gf-form--has-input-icon gf-form--grow">
        <div className="tag-filter">
          <Async {...selectOptions} />
        </div>
        <i className="gf-form-input-icon fa fa-tag" />
      </div>
    );
  }
}
