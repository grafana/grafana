import _ from 'lodash';
import React from 'react';
import { Async } from 'react-select';
import { TagValue } from './TagValue';
import { TagOption } from './TagOption';

export interface IProps {
  tags: string[];
  inlineTags: any;
  label: string;
  tagOptions: () => any;
  onSelect: (tag: string) => void;
}

export class TagFilter extends React.Component<IProps, any> {
  inlineTags: boolean;

  constructor(props) {
    super(props);

    // Default is true
    this.inlineTags = this.props.inlineTags === undefined ? true : this.props.inlineTags;

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
      className: 'width-8 gf-form-input gf-form-input--form-dropdown',
      placeholder: 'Select Tags',
      loadingPlaceholder: 'Loading...',
      noResultsText: 'No tags found',
      optionComponent: TagOption,
    };

    if (this.inlineTags) {
      selectOptions['valueComponent'] = TagValue;

      return (
        <div className="gf-form">
          <label className="gf-form-label width-4">{this.props.label}</label>
          <div className="tag-filter">
            <Async {...selectOptions} />
          </div>
        </div>
      );
    } else {
      selectOptions['valueComponent'] = () => false;

      const tagsBadges = _.map(this.props.tags, tag => {
        return (
          <TagValue key={tag} value={{ label: tag }} className="" onClick={this.onChange} onRemove={this.onTagRemove} />
        );
      });

      return (
        <div>
          <div className="gf-form">
            <label className="gf-form-label width-4">{this.props.label}</label>
            <div className="tag-filter">
              <Async {...selectOptions} />
            </div>
          </div>
          <div className="gf-form">
            <label className="gf-form-label width-4">&nbsp;</label>
            <div className="tag-filter-values">{tagsBadges}</div>
          </div>
        </div>
      );
    }
  }
}
