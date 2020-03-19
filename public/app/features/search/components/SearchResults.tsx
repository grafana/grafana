import React, { FC } from 'react';
import { e2e } from '@grafana/e2e';
import { Forms, Icon } from '@grafana/ui';
import { IconType } from '@grafana/ui/src/components/Icon/types';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSection, DashboardSectionItem } from '../types';

interface Props {
  results: DashboardSection[] | undefined;
  onSelectionChanged: any;
  onTagSelected: any;
  onFolderExpanding: any;
  onToggleSelection: (item: DashboardSectionItem | DashboardSection, event: any) => void;
  editable: boolean;
  selectors: typeof e2e.pages.Dashboards.selectors;
}

export const SearchResults: FC<Props> = ({
  results,
  onSelectionChanged,
  onTagSelected,
  onFolderExpanding,
  onToggleSelection,
  editable,
  selectors,
}) => {
  const toggleFolderExpand = (section: DashboardSection) => {
    if (section.toggle) {
      if (!section.expanded && typeof onFolderExpanding === 'function') {
        onFolderExpanding();
      }

      section.toggle(section).then(() => {
        if (typeof onSelectionChanged === 'function') {
          onSelectionChanged();
        }
      });
    }
  };
  const onItemClick = (item: DashboardSectionItem) => {
    //Check if one string can be found in the other
    if (window.location.pathname.includes(item.url) || item.url.includes(window.location.pathname)) {
      appEvents.emit(CoreEvents.hideDashSearch);
    }
  };

  return !results ? (
    <p>No results</p>
  ) : (
    <>
      {results.map(section => (
        <div className="search-section" key={section.id}>
          {!section.hideHeader ? (
            <div
              className={`search-section__header pointer ${section.checked ? 'selected' : ''}`}
              onClick={() => toggleFolderExpand(section)}
            >
              <div onClick={e => onToggleSelection(section, e)} className="center-vh">
                {editable && <Forms.Checkbox value={section.checked} onChange={onSelectionChanged} />}
              </div>
              <Icon className="search-section__header__icon" name={section.icon as IconType} />

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
          {section.expanded &&
            section.items.map(item => (
              <div key={item.id} aria-label={selectors.dashboards(item.title)}>
                <a className={`search-item search-item--indent  ${item.checked ? 'selected' : ''}`} href={item.url}>
                  <div onClick={e => onToggleSelection(item, e)} className="center-vh">
                    {editable && <Forms.Checkbox value={item.checked} onChange={onSelectionChanged} />}
                  </div>
                  <span className="search-item__icon">
                    <Icon name="th-large" />
                  </span>
                  <span className="search-item__body" onClick={() => onItemClick(item)}>
                    <div className="search-item__body-title">{item.title}</div>
                    <span className="search-item__body-folder-title">{item.folderTitle}</span>
                  </span>
                  <span className="search-item__tags">
                    {item.tags.map(tag => (
                      <span key={tag} onClick={() => onTagSelected(tag)} className="label label-tag">
                        {tag}
                      </span>
                    ))}
                  </span>
                </a>
              </div>
            ))}
        </div>
      ))}
    </>
  );
};
