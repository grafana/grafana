import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';
import { setSectionsAndItemsSelected } from './state/actions';
import {
  getAllChecked,
  getCanDelete,
  getCanMove,
  getSelectedStarredFilter,
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
}

interface State {
  starredFilterOptions: any[];
}

export class SectionActions extends PureComponent<Props, State> {
  state = {
    starredFilterOptions: [{ text: 'Filter by Starred', disabled: true }, { text: 'Yes' }, { text: 'No' }],
    tagFilterOptions: [],
  };

  onSelectAllChanged = () => {
    const { allChecked, setSectionsAndItemsSelected } = this.props;
    setSectionsAndItemsSelected(!allChecked);
  };

  onStarredFilterChange = event => {};

  onTagFilterChange = event => {};

  moveTo = () => {};

  delete = () => {};

  render() {
    const { allChecked, canMove, canDelete, selectedStarredFilter, selectedTagFilter, tagFilterOptions } = this.props;

    const { starredFilterOptions } = this.state;

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
                <div className="gf-form-select-wrapper">
                  <select
                    className="search-results-filter-row__filters-item gf-form-input"
                    value={selectedStarredFilter}
                    onChange={this.onStarredFilterChange}
                  >
                    {starredFilterOptions.map((option, index) => {
                      return (
                        <option value={option.text} key={`${option.text}-${index}`}>
                          {option.text}
                        </option>
                      );
                    })}
                  </select>
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
    selectedStarredFilter: getSelectedStarredFilter(state.manageDashboards),
    selectedTagFilter: getSelectedTagFilter(state.manageDashboards),
    tagFilterOptions: getTagFilterOptions(state.sections),
  };
}

const mapDispatchToProps = {
  setSectionsAndItemsSelected,
};

export default connect(mapStateToProps, mapDispatchToProps)(SectionActions);
