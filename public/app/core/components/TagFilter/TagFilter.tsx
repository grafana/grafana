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
  }

  searchTags(query) {
    return this.props.tagOptions().then(options => {
      const tags = _.map(options, tagOption => {
        return { value: tagOption.term, label: tagOption.term, count: tagOption.count };
      });
      return { options: tags };
    });
  }

  onChange(newOption) {
    this.props.onSelect(newOption);
  }

  render() {
    if (this.inlineTags) {
      return (
        <div className="gf-form">
          <label className="gf-form-label width-4">{this.props.label}</label>
          <div className="tag-filter">
            <Async
              loadOptions={this.searchTags}
              onChange={this.onChange}
              value={this.props.tags}
              multi={true}
              className="width-8 gf-form-input gf-form-input--form-dropdown"
              placeholder="Select Tags"
              loadingPlaceholder="Loading..."
              noResultsText="No tags found"
              valueComponent={TagValue}
              optionComponent={TagOption}
            />
          </div>
        </div>
      );
    } else {
      const valueComponent = () => false;
      const tagsBadges = _.map(this.props.tags, tag => {
        return (
          <TagValue key={tag} value={{ label: tag }} className="" onClick={this.onChange} onRemove={this.onChange} />
        );
      });

      return (
        <div>
          <div className="gf-form">
            <label className="gf-form-label width-4">{this.props.label}</label>
            <div className="tag-filter">
              <Async
                loadOptions={this.searchTags}
                onChange={this.onChange}
                value={this.props.tags}
                multi={true}
                className="width-8 gf-form-input gf-form-input--form-dropdown"
                placeholder="Select Tags"
                loadingPlaceholder="Loading..."
                noResultsText="No tags found"
                valueComponent={valueComponent}
                optionComponent={TagOption}
              />
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
