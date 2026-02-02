import React, { useReducer, useState, useEffect, useRef } from 'react';

import { SelectableValue } from '@grafana/data';
import { Icon, IconName, useTheme2 } from '@grafana/ui';

import { SearchResult } from '../components/search-result/SearchResult';

const searchConfig = {
  searchPlaceholder: 'Search',
  listItem: {
    iconName: 'plus-circle' as IconName,
    iconTooltip: 'Add item',
  },
};

export interface DomainFilterProps {
  resultItems: SelectableValue[];
  onSearch: (query: string) => void;
  onDomainDrillDown: (item: SelectableValue) => void;
  onDomainSelected: (selected: SelectableValue[]) => void;
  onBreadCrumbsItemClick: (item: SelectableValue) => void;
  breadcrumbsItems: SelectableValue[];
  loading?: boolean;
  selected: SelectableValue[];
  onCancel: () => void;
  onNavigate: (query: string, toPage: number) => void;
  onToggle: (open: boolean) => void;
  count: number;
}
export const DomainFilter: React.FC<DomainFilterProps> = (props) => {
  const [showSearch, toggleSearch] = useReducer((showSearch) => !showSearch, false);
  const [searchQuery, setSearchQuery] = useState('');
  const [startPage, setStartPage] = useState(1);
  const searchRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    document.addEventListener('mousedown', onOutsideClick);
    return () => {
      document.removeEventListener('mousedown', onOutsideClick);
    };
  });

  const theme = useTheme2();

  const onDomainClicked = (item: SelectableValue) => {
    if (item.selected) {
      const selected = props.selected.filter((domain) => domain.value !== item.value);
      onItemRemoved(selected);
    } else {
      onDomainSelected(item);
    }
  };
  const onDomainSelected = (selectedItem: SelectableValue) => {
    if (props.selected.find((domain) => domain.value === selectedItem.value)) {
      return;
    }
    const domains = props.selected.concat([selectedItem]);
    props.onDomainSelected(domains);
  };

  const onToggleSearch = () => {
    setSearchQuery('');
    toggleSearch();
    props.onToggle(!showSearch);
  };

  const onItemRemoved = (items: SelectableValue[]) => {
    props.onDomainSelected(items);
  };

  const deselectAll = () => {
    props.onCancel();
  };

  const onNavigate = (query: string, toPage: number) => {
    props.onNavigate(query, toPage);
  };

  const onSearch = (searchQuery: string) => {
    setSearchQuery(searchQuery);
    props.onSearch(searchQuery);
  };

  const onOutsideClick = (e: MouseEvent) => {
    const { target } = e;
    if (showSearch && !searchRef.current?.contains(target as HTMLBaseElement)) {
      onToggleSearch();
    }
  };

  const getSelectedTitle = () => {
    return props.selected?.length > 0 ? props.selected.map((item: SelectableValue) => item.label).join(', ') : '';
  };

  return (
    <>
      <div
        style={{ alignItems: 'center', alignSelf: 'center' }}
        className="gf-form-inline gf-form-inline--xs-view-flex-column flex-grow-1"
      >
        {props.selected?.length > 0 ? (
          <div style={{ display: 'flex' }}>
            <div
              title={props.selected?.length > 0 ? getSelectedTitle() : ''}
              style={{ maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {getSelectedTitle()}
            </div>
            <div>({props.selected?.length} selected)</div>
          </div>
        ) : (
          <div>No Domain Selected</div>
        )}
        <div data-testid="domain-picker-toggle-search" onClick={onToggleSearch}>
          <Icon size={'xl'} name={!showSearch ? 'angle-down' : 'angle-up'} />
        </div>
      </div>
      {showSearch && (
        <div
          ref={searchRef}
          style={{
            backgroundColor: theme.colors.background.primary,
            padding: '8px',
            position: 'absolute',
            zIndex: 10,
            left: '60px',
            top: '40px',
            border: `1px solid ${theme.colors.border.medium}`,
            width: '1000px',
          }}
        >
          <SearchResult
            onDeselectAllClick={deselectAll}
            selectedItems={props.selected}
            onSelectedItemRemoved={onItemRemoved}
            searchQuery={searchQuery}
            startPage={startPage}
            onPageChanged={setStartPage}
            resultItems={props.resultItems}
            loading={props.loading}
            searchInputWidth={55}
            onSearch={(searchQuery: string) => onSearch(searchQuery)}
            config={searchConfig}
            onItemClicked={onDomainClicked}
            onItemDrillDown={props.onDomainDrillDown}
            breadcrumbsItems={props.breadcrumbsItems}
            onBreadCrumbsItemClick={props.onBreadCrumbsItemClick}
            onClose={() => {
              toggleSearch();
              setSearchQuery('');
            }}
            onNavigate={(query: string, toPage: number) => onNavigate(query, toPage)}
            count={props?.count}
          />
        </div>
      )}
    </>
  );
};
