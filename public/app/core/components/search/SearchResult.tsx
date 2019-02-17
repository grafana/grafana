import React from 'react';
import classNames from 'classnames';

export class SearchResult extends React.Component<any, any> {
  constructor(props) {
    super(props);

    this.state = {
      search: '',
    };
  }

  render() {
    return this.state.search.sections.map(section => {
      return <SearchResultSection section={section} key={section.id} />;
    });
  }
}

export interface SectionProps {
  section: any;
}

export class SearchResultSection extends React.Component<SectionProps, any> {
  constructor(props) {
    super(props);
  }

  renderItem(item) {
    return (
      <a className="search-item" href={item.url} key={item.id}>
        <span className="search-item__icon">
          <i className="fa fa-th-large" />
        </span>
        <span className="search-item__body">
          <div className="search-item__body-title">{item.title}</div>
        </span>
      </a>
    );
  }

  toggleSection = () => {
    this.props.section.toggle();
  };

  render() {
    const collapseClassNames = classNames({
      fa: true,
      'fa-plus': !this.props.section.expanded,
      'fa-minus': this.props.section.expanded,
      'search-section__header__toggle': true,
    });

    return (
      <div className="search-section" key={this.props.section.id}>
        <div className="search-section__header">
          <i className={classNames('search-section__header__icon', this.props.section.icon)} />
          <span className="search-section__header__text">{this.props.section.title}</span>
          <i className={collapseClassNames} onClick={this.toggleSection} />
        </div>
        {this.props.section.expanded && (
          <div className="search-section__items">{this.props.section.items.map(this.renderItem)}</div>
        )}
      </div>
    );
  }
}
