import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DashboardSection } from 'app/types';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';
import { collapseSection, loadSectionItems } from './state/actions';

interface Props {
  section: DashboardSection;
  loadSectionItems: typeof loadSectionItems;
  collapseSection: typeof collapseSection;
}

export class Section extends PureComponent<Props> {
  toggleFolderExpand = () => {
    const { section, loadSectionItems, collapseSection } = this.props;

    if (section.expanded) {
      collapseSection(section.id);
    } else {
      loadSectionItems(section.id);
    }
  };

  toggleSelection = () => {};

  selectionChanged = event => {};

  onItemClick = item => {};

  selectTag = (tag, event) => {};

  render() {
    const { section } = this.props;

    return (
      <div className="search-section">
        <div
          className={`search-section__header pointer ${section.selected ? 'selected' : ''}`}
          onClick={this.toggleFolderExpand}
        >
          <div onClick={this.toggleSelection}>
            <FormSwitch
              label=""
              onChange={this.selectionChanged}
              checked={section.checked}
              switchClass="gf-form-switch--transparent gf-form-switch--search-result__section"
            />
          </div>
          <i className={`search-section__header__icon ${section.icon}`} />
          <span className="search-section__header__text">{section.title}</span>
          {section.url && (
            <a href={section.url} className="search-section__header__link">
              <i className="fa fa-cog" />
            </a>
          )}
          {section.expanded && <i className="fa fa-angle-down search-section__header__toggle" />}
          {!section.expanded && <i className="fa fa-angle-right search-section__header__toggle" />}
        </div>
        {section.hideHeader && <div className="search-section__header" />}
        {section.expanded &&
          section.items.map((item, index) => {
            return (
              <a
                className={`search-item search-item--indent${item.selected ? 'selected' : ''}`}
                href={item.url}
                key={index}
              >
                <div onClick={this.toggleSelection}>
                  <FormSwitch
                    label=""
                    onChange={this.selectionChanged}
                    checked={item.checked}
                    switchClass="gf-form-switch--transparent gf-form-switch--search-result__item"
                  />
                </div>
                <span className="search-item__icon">
                  <i className="gicon mini gicon-dashboard-list" />
                </span>
                <span className="search-item__body" onClick={() => this.onItemClick(item)}>
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
          })}
      </div>
    );
  }
}

function mapStateToProps() {
  return {};
}

const mapDispatchToProps = {
  collapseSection,
  loadSectionItems,
};

export default connect(mapStateToProps, mapDispatchToProps)(Section);
