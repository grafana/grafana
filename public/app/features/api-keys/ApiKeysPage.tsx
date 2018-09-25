import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { NavModel, ApiKey } from '../../types';
import { getNavModel } from 'app/core/selectors/navModel';
// import { getSearchQuery, getTeams, getTeamsCount } from './state/selectors';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import { loadApiKeys, deleteApiKey } from './state/actions';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';

export interface Props {
  navModel: NavModel;
  apiKeys: ApiKey[];
  searchQuery: string;
  loadApiKeys: typeof loadApiKeys;
  deleteApiKey: typeof deleteApiKey;
  // loadTeams: typeof loadTeams;
  // deleteTeam: typeof deleteTeam;
  // setSearchQuery: typeof setSearchQuery;
}

export class ApiKeysPage extends PureComponent<Props, any> {
  componentDidMount() {
    this.fetchApiKeys();
  }

  async fetchApiKeys() {
    await this.props.loadApiKeys();
  }

  deleteApiKey(id: number) {
    return () => {
      this.props.deleteApiKey(id);
    };
  }

  render() {
    const { navModel, apiKeys } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        <div className="page-container page-body">
          <h3 className="page-heading">Existing Keys</h3>
          <table className="filter-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th style={{ width: '34px' }} />
              </tr>
            </thead>
            {apiKeys.length > 0 ? (
              <tbody>
                {apiKeys.map(key => {
                  // id, name, role
                  return (
                    <tr key={key.id}>
                      <td>{key.name}</td>
                      <td>{key.role}</td>
                      <td>
                        <a onClick={this.deleteApiKey(key.id)} className="btn btn-danger btn-mini">
                          <i className="fa fa-remove" />
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ) : null}
          </table>
        </div>
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'apikeys'),
    apiKeys: state.apiKeys.keys,
    //   searchQuery: getSearchQuery(state.teams),
  };
}

const mapDispatchToProps = {
  loadApiKeys,
  deleteApiKey,
  // loadTeams,
  // deleteTeam,
  // setSearchQuery,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ApiKeysPage));
