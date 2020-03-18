import React, { FC } from 'react';
import { e2e } from '@grafana/e2e';
import { Forms, Icon } from '@grafana/ui';
import { IconType } from '@grafana/ui/src/components/Icon/types';

interface Props {
  results: any;
  onSelectionChanged: any;
  onTagSelected: any;
  onFolderExpanding: any;
  editable: boolean;
  selectors: typeof e2e.pages.Dashboards.selectors;
}

export const SearchResults: FC<Props> = ({
  results,
  onSelectionChanged,
  onTagSelected,
  onFolderExpanding,
  editable,
  selectors,
}) => {
  const toggleSelection = () => {};
  const toggleFolderExpand = (section: any) => {};

  // Remove 'fa' prefixes from icon names
  // TODO this should be probably handled on backend
  const parseIconName = (name: string) => {
    if (name) {
      const splitName = name.split('-');
      return splitName.slice(1).join('-');
    }

    return '';
  };

  return !results ? (
    <p>No results</p>
  ) : (
    results.map(section => (
      <div className="search-section" key={section.id}>
        {!section.hideHeader ? (
          <div
            className={`search-section__header pointer ${section.selected ? 'selected' : ''}`}
            onClick={toggleFolderExpand}
          >
            <div onClick={toggleSelection} className="center-vh">
              {editable && <Forms.Checkbox value={section.checked} onChange={onSelectionChanged} />}
            </div>
            <Icon className="search-section__header__icon" name={parseIconName(section.icon) as IconType} />

            <span className="search-section__header__text">{section.title}</span>
            {section.url && (
              <a href={section.url} className="search-section__header__link">
                <Icon name="cog" />
              </a>
            )}
            {section.expanded ? (
              <Icon name="angle-down" className="search-section__header__toggle" />
            ) : (
              <Icon name="angle-right" className="search-section__header__toggle" />
            )}
          </div>
        ) : (
          <div className="search-section__header" />
        )}
      </div>
    ))
  );
};
