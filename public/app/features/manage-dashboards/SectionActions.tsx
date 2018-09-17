import React, { PureComponent } from 'react';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';

export interface Props {
  selectAll: boolean;
  canMove: boolean;
  canDelete: boolean;
  starredFilterOptions: any[];
  selectedStarredFilter: string;
  tagFilterOptions: any[];
  selectedTagFilter: string;
}

export class SectionActions extends PureComponent<Props> {
  onSelectAllChanged = () => {
    const { allSelected, setAllSectionsAndItemsSelected } = this.props;
    setAllSectionsAndItemsSelected(!allSelected);
  };

  onStarredFilterChange = event => {};

  onTagFilterChange = event => {};

  moveTo = () => {};

  delete = () => {};

  render() {
    const {
      selectAll,
      canMove,
      canDelete,
      starredFilterOptions,
      selectedStarredFilter,
      tagFilterOptions,
      selectedTagFilter,
    } = this.props;

    return (
      <div className="search-results">
        <div className="search-results-filter-row">
          <FormSwitch
            label=""
            onChange={this.onSelectAllChanged}
            checked={selectAll}
            switchClass="gf-form-switch--transparent gf-form-switch--search-result-filter-row__checkbox"
          />
          <div className="search-results-filter-row__filters">
            {(canMove || canDelete) && (
              <div>
                <div className="gf-form-select-wrapper">
                  <select
                    className="search-results-filter-row__filters-item gf-form-input"
                    value={selectedStarredFilter}
                    onChange={this.onStarredFilterChange}
                  >
                    {starredFilterOptions.map((option, index) => {
                      return <option value="" key={`${option.value}-${index}`} />;
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
                      return <option key={option.value}>{}</option>;
                    })}
                  </select>
                </div>
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
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default SectionActions;
