import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import appEvents from '../../core/app_events';
import FormSwitch from 'app/core/components/FormSwitch/FormSwitch';
import {
  addTagFilter,
  deleteFoldersAndDashboards,
  setSectionsAndItemsSelected,
  toggleStarredFilter,
  loadSections,
} from './state/actions';
import {
  getAllChecked,
  getCanDelete,
  getCanMove,
  getFilterOnStarred,
  getSelectedDashboards,
  getSelectedFoldersAndDashboards,
  getSelectedTagFilter,
  getTagFilterOptions,
} from './state/selectors';

export interface Props {
  canMove: boolean;
  canDelete: boolean;
  selectedTagFilter: string;
  setSectionsAndItemsSelected: typeof setSectionsAndItemsSelected;
  allChecked: boolean;
  tagFilterOptions: any[];
  addTagFilter: typeof addTagFilter;
  toggleStarredFilter: typeof toggleStarredFilter;
  filterOnStarred: boolean;
  selectedDashboards: string[];
  loadSections: typeof loadSections;
  selectedFoldersAndDashboards: { folders: string[]; dashboards: string[] };
  deleteFoldersAndDashboards: typeof deleteFoldersAndDashboards;
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

  moveSelectedDashboards = () => {
    const { selectedDashboards, loadSections } = this.props;

    const template =
      '<move-to-folder-modal dismiss="dismiss()" ' +
      'dashboards="model.dashboards" after-save="model.afterSave()">' +
      '</move-to-folder-modal>';

    appEvents.emit('show-modal', {
      templateHtml: template,
      modalClass: 'modal--narrow',
      model: {
        dashboards: selectedDashboards,
        afterSave: loadSections,
      },
    });
  };

  delete = () => {
    const { selectedFoldersAndDashboards, deleteFoldersAndDashboards } = this.props;
    const { folders, dashboards } = selectedFoldersAndDashboards;

    const folderCount = folders.length;
    const dashCount = dashboards.length;
    let text = 'Do you want to delete the ';
    let text2;

    if (folderCount > 0 && dashCount > 0) {
      text += `selected folder${folderCount === 1 ? '' : 's'} and dashboard${dashCount === 1 ? '' : 's'}?`;
      text2 = `All dashboards of the selected folder${folderCount === 1 ? '' : 's'} will also be deleted`;
    } else if (folderCount > 0) {
      text += `selected folder${folderCount === 1 ? '' : 's'} and all its dashboards?`;
    } else {
      text += `selected dashboard${dashCount === 1 ? '' : 's'}?`;
    }

    appEvents.emit('confirm-modal', {
      title: 'Delete',
      text: text,
      text2: text2,
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        deleteFoldersAndDashboards(folders, dashboards);
      },
    });
  };

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
                  onClick={this.moveSelectedDashboards}
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
    canDelete: getCanDelete(state.sections),
    canMove: getCanMove(state.sections),
    selectedTagFilter: getSelectedTagFilter(state.manageDashboards),
    tagFilterOptions: getTagFilterOptions(state.sections),
    filterOnStarred: getFilterOnStarred(state.manageDashboards),
    selectedDashboards: getSelectedDashboards(state.sections),
    selectedFoldersAndDashboards: getSelectedFoldersAndDashboards(state.sections),
  };
}

const mapDispatchToProps = {
  addTagFilter,
  toggleStarredFilter,
  setSectionsAndItemsSelected,
  loadSections,
  deleteFoldersAndDashboards,
};

export default connect(mapStateToProps, mapDispatchToProps)(SectionActions);
