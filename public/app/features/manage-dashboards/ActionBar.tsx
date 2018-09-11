import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { searchDashboards } from './state/actions';

export interface Props {
  searchQuery: string;
  hasEditPermissionInFolders: boolean;
  canSave: boolean;
  isEditor: boolean;
  folderId: number;
  searchDashboards: typeof searchDashboards;
}

export interface State {
  searchQuery: string;
}

export class ActionBar extends PureComponent<Props, State> {
  constructor(props) {
    super(props);

    this.state = {
      searchQuery: '',
    };
  }

  onSearchQueryChange = event => {
    this.setState({ searchQuery: event.target.value });

    this.props.searchDashboards(event.target.value);
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
            <i className="fa fa-plus" />
            Dashboard
          </a>
        )}
        {folderId &&
          isEditor && (
            <a className="btn btn-success" href="dashboards/folder/new">
              <i className="fa fa-plus" />
              Folder
            </a>
          )}
        {hasEditPermissionInFolders || canSave}
        <a className="btn btn-success" href={this.importDashboardUrl()}>
          <i className="fa fa-plus" />
          Import
        </a>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {};
}

const mapDispatchToProps = {
  searchDashboards,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ActionBar));
