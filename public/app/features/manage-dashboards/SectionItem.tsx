import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import FormSwitch from '../../core/components/FormSwitch/FormSwitch';
import { DashboardSectionItem } from '../../types';
import { addTagFilter, setSectionItemSelected } from './state/actions';
import { updateLocation } from '../../core/actions';

export interface Props {
  item: DashboardSectionItem;
  setSectionItemSelected: typeof setSectionItemSelected;
  addTagFilter: typeof addTagFilter;
  updateLocation: typeof updateLocation;
}

export class SectionItem extends PureComponent<Props> {
  toggleSectionItemSelection = event => {
    event.preventDefault();
    event.stopPropagation();

    const { item, setSectionItemSelected } = this.props;

    setSectionItemSelected(item);
  };

  onItemClick = event => {
    event.stopPropagation();
    console.log('clicked an item');
  };

  selectTag = (tag, event) => {
    event.stopPropagation();
    event.preventDefault();

    this.props.addTagFilter(tag);
  };

  navigateToDashboard = () => {
    this.props.updateLocation({ path: this.props.item.url });
  };

  render() {
    const { item } = this.props;

    return (
      <a className={`search-item search-item--indent${item.checked ? 'selected' : ''}`} href={item.url} target="_self">
        <FormSwitch
          label=""
          onChange={event => this.toggleSectionItemSelection(event)}
          checked={item.checked}
          switchClass="gf-form-switch--transparent gf-form-switch--search-result__item"
        />
        <span className="search-item__icon" onClick={this.navigateToDashboard}>
          <i className="gicon mini gicon-dashboard-list" />
        </span>
        <span className="search-item__body" onClick={this.navigateToDashboard}>
          <div className="search-item__body-title">{item.title}</div>
        </span>
        <span className="search-item__tags">
          {item.tags.map((tag, index) => {
            return (
              <span key={index} tag-color-from-name="tag" className="label label-tag">
                {tag}
              </span>
            );
          })}
        </span>
      </a>
    );
  }
}

const mapDispatchToProps = {
  addTagFilter,
  setSectionItemSelected,
  updateLocation,
};

export default connect(() => {
  return {};
}, mapDispatchToProps)(SectionItem);
