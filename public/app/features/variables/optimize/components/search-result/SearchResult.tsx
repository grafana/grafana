import React, { useState, MouseEvent, KeyboardEvent } from 'react';

import { SelectableValue } from '@grafana/data';
import {
  Button,
  EmptySearchResult,
  Input,
  IconName,
  LoadingPlaceholder,
  VerticalGroup,
  Icon,
  Pagination,
  useTheme2,
} from '@grafana/ui';

import { DEFAULT_PAGINATION } from '../../OptimizeVariablePicker';
import { BreadCrumbs } from '../breadcrumbs/BreadCrumbs';
import { SelectableListGroup } from '../selectable-list-group/SelectableListGroup';
import { TagList } from '../tag-list/TagList';

export interface SearchResultProp {
  onSearch: (query: string) => void;
  searchQuery: string;
  selectedItems: SelectableValue[];
  onSelectedItemRemoved: (selected: SelectableValue[]) => void;
  onItemClicked: (selected: SelectableValue) => void;
  onItemDrillDown?: (selected: SelectableValue) => void;
  onBreadCrumbsItemClick?: (selected: SelectableValue) => void;
  onDeselectAllClick: () => void;
  breadcrumbsItems: SelectableValue[];
  resultItems: SelectableValue[];
  containerClassName?: string;
  width?: string;
  searchInputWidth?: number;
  loading?: boolean;
  config?: {
    searchButton?: string;
    emptyResultMsg?: string;
    searchPlaceholder?: string;
    listItem?: {
      iconName: IconName;
      iconTooltip?: string;
    };
  };
  onClose: () => void;
  onNavigate: (query: string, toPage: number) => void;
  count: number;
  startPage: number;
  onPageChanged: (page: number) => void;
}
export const SearchResult: React.FC<SearchResultProp> = (props: SearchResultProp) => {
  const [queryValue, setQueryValue] = useState(props.searchQuery || '');
  const [currentPage, setCurrentPage] = useState(props.startPage);
  const theme = useTheme2();

  const onQueryChange = (value: string) => {
    setQueryValue(value);
  };

  const onSearchClicked = (e: MouseEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    props.onPageChanged(1);
    props.onSearch(queryValue);
  };

  const onSearchKeyPressed = (keyboardEvent: KeyboardEvent<HTMLInputElement>) => {
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      setCurrentPage(1);
      props.onPageChanged(1);
      props.onSearch(queryValue);
    }
  };

  const onItemDrillDown = (selected: SelectableValue): void => {
    if (props.onItemDrillDown) {
      setQueryValue('');
      setCurrentPage(1);
      props.onPageChanged(1);
      props.onItemDrillDown(selected);
    }
  };

  const onBreadCrumbsItemClick = (selected: SelectableValue) => {
    if (props.onBreadCrumbsItemClick) {
      setQueryValue('');
      setCurrentPage(1);
      props.onPageChanged(1);
      props.onBreadCrumbsItemClick(selected);
    }
  };

  const styles = {
    closeIconContainer: {
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'flex-end',
      width: '100%',
    },
    pagination: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 'auto',
      paddingTop: '12px',
    },
    paginationResults: {
      marginLeft: 'auto',
      marginRight: '12px',
    },
    mainContainer: {
      display: 'flex',
      width: '100%',
    },
    allItemsContainer: {
      display: 'flex',
      flexDirection: 'column' as 'column',
      width: '60%',
      borderRight: '1px solid ' + theme.colors.border.medium,
      paddingRight: '8px',
    },
    resultContainer: {
      height: '55vh',
      overflow: 'hidden auto',
    },
    selectedItemsContainer: {
      height: '55vh',
      overflow: 'hidden auto',
      width: '40%',
      padding: '8px',
    },
    searchInputContainer: {
      display: 'flex',
      marginBottom: '12px',
    },
    selectedItemsHeader: {
      display: 'flex',
      marginBottom: '5px',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
  };

  let resultContainer;
  if (props.loading) {
    resultContainer = <LoadingPlaceholder text="Loading..." />;
  } else {
    resultContainer =
      props.resultItems?.length > 0 ? (
        <SelectableListGroup
          listItem={props.config?.listItem ?? { iconName: 'plus-circle' }}
          items={props.resultItems}
          onItemDrillDown={onItemDrillDown}
          onClick={props.onItemClicked}
        />
      ) : (
        <EmptySearchResult>{props.config?.emptyResultMsg || 'No items'}</EmptySearchResult>
      );
  }
  const onNavigate = (toPage: number) => {
    setCurrentPage(toPage);
    props.onPageChanged(toPage);
    props.onNavigate(queryValue, toPage);
  };

  const getNumberOfPages = (count: number): number => {
    if (count && count > 0) {
      return Math.ceil(count / DEFAULT_PAGINATION.size);
    }
    return 0;
  };

  const prefixIcon = <Icon name="search" />;

  function getNumerOfItemsPerPage(currentPage: number, count: number): number {
    const numberOfPages = getNumberOfPages(count);
    if (currentPage === numberOfPages) {
      return count;
    }
    return currentPage * DEFAULT_PAGINATION.size;
  }

  function getPaginationNum(count: number): string {
    if (count && count > 0 && count > DEFAULT_PAGINATION.size) {
      return (
        (currentPage - 1) * DEFAULT_PAGINATION.size + 1 + ' - ' + getNumerOfItemsPerPage(currentPage, count) + ' of '
      );
    }
    return '';
  }

  function onKeyPress(keyboardEvent: KeyboardEvent<HTMLInputElement>) {
    if (keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
    }
  }

  return (
    <>
      <VerticalGroup className={props.containerClassName} width={props.width}>
        <div
          data-testid="domain-picker-close-search-panel"
          onClick={() => props.onClose()}
          style={styles.closeIconContainer}
        >
          <Icon name={'times'} size={'md'} title={'Close'} />
        </div>
        <div style={styles.mainContainer}>
          <div style={styles.allItemsContainer}>
            <div style={styles.searchInputContainer}>
              <Input
                data-testid="domain-picker-search-input"
                prefix={prefixIcon}
                width={props.searchInputWidth}
                placeholder={props.config?.searchPlaceholder || 'Type to search'}
                value={queryValue}
                onChange={(elm) => onQueryChange(elm.currentTarget.value)}
                onKeyPress={(ev) => onKeyPress(ev)}
                onKeyUp={onSearchKeyPressed}
              ></Input>
              <Button data-testid="domain-picker-search-button" variant={'secondary'} onClick={onSearchClicked}>
                {props.config?.searchButton || 'Search'}
              </Button>
            </div>
            <BreadCrumbs items={props.breadcrumbsItems} onClick={onBreadCrumbsItemClick}></BreadCrumbs>
            <div style={styles.resultContainer}>{resultContainer}</div>
            {props.resultItems?.length > 0 && (
              <div style={styles.pagination}>
                <Pagination
                  className={'search-results-pagination'}
                  currentPage={currentPage}
                  numberOfPages={getNumberOfPages(props.count)}
                  onNavigate={(toPage: number) => onNavigate(toPage)}
                ></Pagination>
                <div style={styles.paginationResults}>
                  {getPaginationNum(props.count)} {props.count} results{' '}
                </div>
              </div>
            )}
          </div>
          <div style={styles.selectedItemsContainer}>
            <div>
              <div style={styles.selectedItemsHeader}>
                <div>Selected Domains</div>
                <div
                  data-testid="domain-picker-deselect-all-link"
                  style={{
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  className="query-keyword pointer"
                  onClick={props.onDeselectAllClick}
                >
                  Deselect All
                </div>
              </div>
              {props.selectedItems?.length > 0 && (
                <TagList
                  tags={props.selectedItems}
                  getTooltip={(item: SelectableValue) => item.label || ''}
                  onRemove={props.onSelectedItemRemoved}
                  getTitle={(item: SelectableValue) => item.label || ''}
                />
              )}
            </div>
          </div>
        </div>
      </VerticalGroup>
    </>
  );
};
