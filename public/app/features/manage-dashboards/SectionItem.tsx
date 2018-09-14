import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import FormSwitch from '../../core/components/FormSwitch/FormSwitch';
import { DashboardSectionItem } from '../../types';
import { setSectionItemSelected } from './state/actions';

export interface Props {
  item: DashboardSectionItem;
  setSectionItemSelected: typeof setSectionItemSelected;
}

export class SectionItem extends PureComponent<Props> {
  toggleSectionItemSelection = () => {
    const { item } = this.props;

    this.props.setSectionItemSelected(item.folderId, item.id);
  };

  onItemClick = () => {};

  selectTag = (tag, event) => {};

  render() {
    const { item } = this.props;

    return (
      <div className={`search-item search-item--indent${item.selected ? 'selected' : ''}`}>
        <FormSwitch
          label=""
          onChange={this.toggleSectionItemSelection}
          checked={item.checked}
          switchClass="gf-form-switch--transparent gf-form-switch--search-result__item"
        />
        <a href={item.url}>
          <span className="search-item__icon">
            <i className="gicon mini gicon-dashboard-list" />
          </span>
          <span className="search-item__body" onClick={this.onItemClick}>
            <div className="search-item__body-title">{item.title}</div>
          </span>
          <span className="search-item__tags">
            {item.tags.map((tag, index) => {
              return (
                <span
                  key={index}
                  onClick={event => {
                    this.selectTag(tag, event);
                  }}
                  tag-color-from-name="tag"
                  className="label label-tag"
                >
                  {tag}
                </span>
              );
            })}
          </span>
        </a>
      </div>
    );
  }
}

function mapStateToProps() {
  return {};
}

const mapDispatchToProps = {
  setSectionItemSelected,
};

export default connect(mapStateToProps, mapDispatchToProps)(SectionItem);
