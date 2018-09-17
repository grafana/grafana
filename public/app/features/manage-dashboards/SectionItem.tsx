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
  toggleSectionItemSelection = event => {
    const { item } = this.props;

    this.props.setSectionItemSelected(item.folderId, item.id);
  };

  onItemClick = () => {};

  selectTag = (tag, event) => {};

  render() {
    const { item } = this.props;

    return (
      <a className={`search-item search-item--indent${item.checked ? 'selected' : ''}`} href={item.url}>
        <FormSwitch
          label=""
          onChange={event => this.toggleSectionItemSelection(event)}
          checked={item.checked}
          switchClass="gf-form-switch--transparent gf-form-switch--search-result__item"
        />
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
