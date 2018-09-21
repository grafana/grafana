import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { updateSearchQuery } from './state/actions';
import { getCanSave, getFolderId, getHasEditPermissionInFolders, getIsEditor, getSearchQuery } from './state/selectors';

export interface Props {
  searchQuery: string;
  hasEditPermissionInFolders: boolean;
  canSave: boolean;
  isEditor: boolean;
  folderId: number;
  updateSearchQuery: typeof updateSearchQuery;
}

export class ActionBar extends PureComponent<Props> {
  onSearchQueryChange = event => {
    this.props.updateSearchQuery(event.target.value);
  };

  createDashboardUrl = () => {
    const { folderId } = this.props;

    return `dashboard/new${folderId ? '?folderId=' + folderId : ''} `;
  };

  importDashboardUrl = () => {
    const { folderId } = this.props;

    return `dashboard/import${folderId ? '?folderId=' + folderId : ''}`;
  };

  render() {
    const { searchQuery, hasEditPermissionInFolders, canSave, isEditor, folderId } = this.props;

    return (
      <div className="page-action-bar page-action-bar--narrow">
        <label className="gf-form gf-form--grow gf-form--has-input-icon">
          <input
            type="text"
            className="gf-form-input max-width-30"
            placeholder="Find Dashboard by name"
            tabIndex={1}
            give-focus="true"
            value={searchQuery}
            spellCheck={false}
            autoComplete="false"
            autoCorrect="false"
            onChange={this.onSearchQueryChange}
          />
          <i className="gf-form-input-icon fa fa-search" />
        </label>
        <div className="page-action-bar__spacer" />
        {(hasEditPermissionInFolders || canSave) && (
          <a className="btn btn-success" href={this.createDashboardUrl()}>
            <i className="fa fa-plus" /> Dashboard
          </a>
        )}
        {folderId !== undefined &&
          isEditor && (
            <a className="btn btn-success" href="dashboards/folder/new">
              <i className="fa fa-plus" /> Folder
            </a>
          )}
        {hasEditPermissionInFolders || canSave}
        <a className="btn btn-success" href={this.importDashboardUrl()}>
          <i className="fa fa-plus" /> Import
        </a>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    searchQuery: getSearchQuery(state.manageDashboards),
    hasEditPermissionInFolders: getHasEditPermissionInFolders(state.manageDashboards),
    canSave: getCanSave(state.manageDashboards),
    isEditor: getIsEditor(state.manageDashboards),
    folderId: getFolderId(state.manageDashboards),
  };
}

const mapDispatchToProps = {
  updateSearchQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ActionBar));
