import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { DashboardSection } from 'app/types';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';
import SectionItem from './SectionItem';
import { collapseSection, loadSectionItems, setSectionSelected } from './state/actions';

export interface Props {
  section: DashboardSection;
  loadSectionItems: typeof loadSectionItems;
  collapseSection: typeof collapseSection;
  setSectionSelected: typeof setSectionSelected;
}

export class Section extends PureComponent<Props> {
  toggleFolder = () => {
    const { section, loadSectionItems, collapseSection } = this.props;

    if (section.expanded) {
      collapseSection(section.id);
    } else {
      loadSectionItems(section.id);
    }
  };

  toggleSectionSelected = event => {
    event.stopPropagation();

    const { section } = this.props;

    this.props.setSectionSelected(section.id);
  };

  render() {
    const { section } = this.props;

    return (
      <div className="search-section">
        <div
          className={`search-section__header pointer ${section.checked ? 'selected' : ''}`}
          onClick={this.toggleFolder}
        >
          <FormSwitch
            label=""
            onChange={event => this.toggleSectionSelected(event)}
            checked={section.checked}
            switchClass="gf-form-switch--transparent gf-form-switch--search-result__section"
          />
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
            return <SectionItem item={item} key={`${item.id}-${index}`} />;
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
  setSectionSelected,
};

export default connect(mapStateToProps, mapDispatchToProps)(Section);
