import React, { FC } from 'react';
import { css, cx } from 'emotion';
import { e2e } from '@grafana/e2e';
import { Forms, Icon } from '@grafana/ui';
import { IconType } from '@grafana/ui/src/components/Icon/types';
import appEvents from 'app/core/app_events';
import { CoreEvents } from 'app/types';
import { DashboardSection, DashboardSectionItem } from '../types';

type clickWithEvent = (item: DashboardSectionItem | DashboardSection, event: any) => void;
interface Props {
  results: DashboardSection[] | undefined;
  onSelectionChanged: any;
  onTagSelected: any;
  onFolderExpanding: any;
  onToggleSelection: clickWithEvent;
  editable: boolean;
}

const { selectors } = e2e.pages.Dashboards;

export const SearchResults: FC<Props> = ({
  results,
  onSelectionChanged,
  onTagSelected,
  onFolderExpanding,
  onToggleSelection,
  editable,
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

  return !results || !results.length ? (
    <div className="search-results">
      <em className="muted">No dashboards found.</em>
    </div>
  ) : (
    <>
      {results.map(section => (
        <div className="search-section" key={section.id}>
          {!section.hideHeader ? (
            <div
              className={cx('search-section__header pointer', { selected: section.checked })}
              onClick={() => toggleFolderExpand(section)}
            >
              <DashboardCheckbox
                editable={editable}
                checked={section.checked}
                onClick={(e: MouseEvent) => onToggleSelection(section, e)}
              />
              <Icon
                className={css`
                  padding: 5px 0;
                  width: 43px;
                `}
                name={section.icon as IconType}
              />

              <span className="search-section__header__text">{section.title}</span>
              {section.url && (
                <a href={section.url} className="search-section__header__link">
                  <Icon name="cog" />
                </a>
              )}
              <Icon name={section.expanded ? 'angle-down' : 'angle-right'} className="search-section__header__toggle" />
            </div>
          ) : (
            <div className="search-section__header" />
          )}
          {section.expanded &&
            section.items.map(item => (
              <ResultsItem key={item.id} {...{ item, editable, onToggleSelection, onTagSelected }} />
            ))}
        </div>
      ))}
    </>
  );
};

interface CheckboxProps {
  checked: boolean;
  onClick: any;
  editable?: boolean;
}
const DashboardCheckbox: FC<CheckboxProps> = ({ checked, onClick, editable = false }) => {
  return (
    editable && (
      <div onClick={onClick} className="center-vh">
        <Forms.Checkbox value={checked} />
      </div>
    )
  );
};

interface ResultsItemProps {
  item: DashboardSectionItem;
  editable?: boolean;
  onToggleSelection: any;
  onTagSelected: any;
}

const ResultsItem: FC<ResultsItemProps> = ({ item, editable, onToggleSelection, onTagSelected }) => {
  const onItemClick = (item: DashboardSectionItem) => {
    //Check if one string can be found in the other
    if (window.location.pathname.includes(item.url) || item.url.includes(window.location.pathname)) {
      appEvents.emit(CoreEvents.hideDashSearch);
    }
  };

  const navigate = (item: DashboardSectionItem) => {
    window.location.pathname = item.url;
  };

  return (
    <div
      aria-label={selectors.dashboards(item.title)}
      className={cx('search-item search-item--indent pointer', { selected: item.checked })}
      onClick={() => navigate(item)}
    >
      <DashboardCheckbox
        editable={editable}
        checked={item.checked}
        onClick={(e: MouseEvent) => onToggleSelection(item, e)}
      />
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
    </div>
  );
};
