import _ from 'lodash';
import React from 'react';
import { Async } from 'react-select';
import { TagValue } from './TagValue';

export interface IProps {
  tags: string[];
  tagOptions: () => any;
  onSelect: (tag: string) => void;
}

export class TagFilter extends React.Component<IProps, any> {
  constructor(props) {
    super(props);

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
    return (
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
        />
      </div>
    );
  }
}
