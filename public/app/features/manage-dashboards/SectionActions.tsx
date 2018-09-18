import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';
import { addTagFilter, setSectionsAndItemsSelected, toggleStarredFilter } from './state/actions';
import {
  getAllChecked,
  getCanDelete,
  getCanMove,
  getFilterOnStarred,
  getSelectedTagFilter,
  getTagFilterOptions,
} from './state/selectors';

export interface Props {
  canMove: boolean;
  canDelete: boolean;
  selectedStarredFilter: string;
  selectedTagFilter: string;
  setSectionsAndItemsSelected: typeof setSectionsAndItemsSelected;
  allChecked: boolean;
  tagFilterOptions: any[];
  addTagFilter: typeof addTagFilter;
  toggleStarredFilter: typeof toggleStarredFilter;
  filterOnStarred: boolean;
}

export class SectionActions extends PureComponent<Props> {
  onSelectAllChanged = () => {
    const { allChecked, setSectionsAndItemsSelected } = this.props;
    setSectionsAndItemsSelected(!allChecked);
  };

  onStarredFilterChange = () => {
    const { filterOnStarred } = this.props;

    this.props.toggleStarredFilter(!filterOnStarred);
  };

  onTagFilterChange = event => {
    this.props.addTagFilter(event.target.value);
  };

  moveTo = () => {};

  delete = () => {};

  render() {
    const { allChecked, canMove, canDelete, filterOnStarred, selectedTagFilter, tagFilterOptions } = this.props;

    return (
      <div className="search-results">
        <div className="search-results-filter-row">
          <FormSwitch
            label=""
            onChange={this.onSelectAllChanged}
            checked={allChecked}
            switchClass="gf-form-switch--transparent gf-form-switch--search-result-filter-row__checkbox"
          />
          <div>
            {!(canMove || canDelete) && (
              <div className="search-results-filter-row__filters">
                <div style={{ display: 'flex', alignItems: 'center', fontSize: '14px' }}>
                  Filter by starred
                  <FormSwitch
                    label=""
                    checked={filterOnStarred}
                    onChange={this.onStarredFilterChange}
                    switchClass="gf-form-switch--transparent gf-form-switch--search-result-filter-row__checkbox"
                  />
                </div>
                <div className="gf-form-select-wrapper">
                  <select
                    className="search-results-filter-row__filters-item gf-form-input"
                    value={selectedTagFilter}
                    onChange={this.onTagFilterChange}
                  >
                    {tagFilterOptions.map((option, index) => {
                      return <option key={`${option.term}-${index}`}>{option.term}</option>;
                    })}
                  </select>
                </div>
              </div>
            )}
            {(canMove || canDelete) && (
              <div className="gf-form-button-row">
                <button
                  type="button"
                  className="btn gf-form-button btn-inverse"
                  disabled={!canMove}
                  onClick={this.moveTo}
                >
                  <i className="fa fa-exchange" />&nbsp;&nbsp;Move
                </button>
                <button
                  type="button"
                  className="btn gf-form-button btn-danger"
                  disabled={!canDelete}
                  onClick={this.delete}
                >
                  <i className="fa fa-trash" />&nbsp;&nbsp;Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    allChecked: getAllChecked(state.sections),
    canDelete: getCanDelete(state),
    canMove: getCanMove(state),
    selectedTagFilter: getSelectedTagFilter(state.manageDashboards),
    tagFilterOptions: getTagFilterOptions(state.sections),
    filterOnStarred: getFilterOnStarred(state.manageDashboards),
  };
}

const mapDispatchToProps = {
  addTagFilter,
  toggleStarredFilter,
  setSectionsAndItemsSelected,
};

export default connect(mapStateToProps, mapDispatchToProps)(SectionActions);
