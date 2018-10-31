import React, { PureComponent } from 'react';
import ReactDOMServer from 'react-dom/server';
import { connect } from 'react-redux';
import { hot } from 'react-hot-loader';
import { NavModel, ApiKey, NewApiKey, OrgRole } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getApiKeys, getApiKeysCount } from './state/selectors';
import { loadApiKeys, deleteApiKey, setSearchQuery, addApiKey } from './state/actions';
import PageHeader from 'app/core/components/PageHeader/PageHeader';
import PageLoader from 'app/core/components/PageLoader/PageLoader';
import SlideDown from 'app/core/components/Animations/SlideDown';
import ApiKeysAddedModal from './ApiKeysAddedModal';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import DeleteButton from 'app/core/components/DeleteButton/DeleteButton';

export interface Props {
  navModel: NavModel;
  apiKeys: ApiKey[];
  searchQuery: string;
  hasFetched: boolean;
  loadApiKeys: typeof loadApiKeys;
  deleteApiKey: typeof deleteApiKey;
  setSearchQuery: typeof setSearchQuery;
  addApiKey: typeof addApiKey;
  apiKeysCount: number;
}

export interface State {
  isAdding: boolean;
  newApiKey: NewApiKey;
}

enum ApiKeyStateProps {
  Name = 'name',
  Role = 'role',
}

const initialApiKeyState = {
  name: '',
  role: OrgRole.Viewer,
};

export class ApiKeysPage extends PureComponent<Props, any> {
  constructor(props) {
    super(props);
    this.state = { isAdding: false, newApiKey: initialApiKeyState };
  }

  componentDidMount() {
    this.fetchApiKeys();
  }

  async fetchApiKeys() {
    await this.props.loadApiKeys();
  }

  onDeleteApiKey(key: ApiKey) {
    this.props.deleteApiKey(key.id);
  }

  onSearchQueryChange = evt => {
    this.props.setSearchQuery(evt.target.value);
  };

  onToggleAdding = () => {
    this.setState({ isAdding: !this.state.isAdding });
  };

  onAddApiKey = async evt => {
    evt.preventDefault();

    const openModal = (apiKey: string) => {
      const rootPath = window.location.origin + config.appSubUrl;
      const modalTemplate = ReactDOMServer.renderToString(<ApiKeysAddedModal apiKey={apiKey} rootPath={rootPath} />);

      appEvents.emit('show-modal', {
        templateHtml: modalTemplate,
      });
    };

    this.props.addApiKey(this.state.newApiKey, openModal);
    this.setState((prevState: State) => {
      return {
        ...prevState,
        newApiKey: initialApiKeyState,
        isAdding: false,
      };
    });
  };

  onApiKeyStateUpdate = (evt, prop: string) => {
    const value = evt.currentTarget.value;
    this.setState((prevState: State) => {
      const newApiKey = {
        ...prevState.newApiKey,
      };
      newApiKey[prop] = value;

      return {
        ...prevState,
        newApiKey: newApiKey,
      };
    });
  };

  renderEmptyList() {
    const { isAdding } = this.state;
    return (
      <div className="page-container page-body">
        {!isAdding && (
          <EmptyListCTA
            model={{
              title: "You haven't added any API Keys yet.",
              buttonIcon: 'fa fa-plus',
              buttonLink: '#',
              onClick: this.onToggleAdding,
              buttonTitle: ' New API Key',
              proTip: 'Remember you can provide view-only API access to other applications.',
              proTipLink: '',
              proTipLinkTitle: '',
              proTipTarget: '_blank',
            }}
          />
        )}
        {this.renderAddApiKeyForm()}
      </div>
    );
  }

  renderAddApiKeyForm() {
    const { newApiKey, isAdding } = this.state;

    return (
      <SlideDown in={isAdding}>
        <div className="cta-form">
          <button className="cta-form__close btn btn-transparent" onClick={this.onToggleAdding}>
            <i className="fa fa-close" />
          </button>
          <h5>Add API Key</h5>
          <form className="gf-form-group" onSubmit={this.onAddApiKey}>
            <div className="gf-form-inline">
              <div className="gf-form max-width-21">
                <span className="gf-form-label">Key name</span>
                <input
                  type="text"
                  className="gf-form-input"
                  value={newApiKey.name}
                  placeholder="Name"
                  onChange={evt => this.onApiKeyStateUpdate(evt, ApiKeyStateProps.Name)}
                />
              </div>
              <div className="gf-form">
                <span className="gf-form-label">Role</span>
                <span className="gf-form-select-wrapper">
                  <select
                    className="gf-form-input gf-size-auto"
                    value={newApiKey.role}
                    onChange={evt => this.onApiKeyStateUpdate(evt, ApiKeyStateProps.Role)}
                  >
                    {Object.keys(OrgRole).map(role => {
                      return (
                        <option key={role} label={role} value={role}>
                          {role}
                        </option>
                      );
                    })}
                  </select>
                </span>
              </div>
              <div className="gf-form">
                <button className="btn gf-form-btn btn-success">Add</button>
              </div>
            </div>
          </form>
        </div>
      </SlideDown>
    );
  }

  renderApiKeyList() {
    const { isAdding } = this.state;
    const { apiKeys, searchQuery } = this.props;

    return (
      <div className="page-container page-body">
        <div className="page-action-bar">
          <div className="gf-form gf-form--grow">
            <label className="gf-form--has-input-icon gf-form--grow">
              <input
                type="text"
                className="gf-form-input"
                placeholder="Search keys"
                value={searchQuery}
                onChange={this.onSearchQueryChange}
              />
              <i className="gf-form-input-icon fa fa-search" />
            </label>
          </div>

          <div className="page-action-bar__spacer" />
          <button className="btn btn-success pull-right" onClick={this.onToggleAdding} disabled={isAdding}>
            <i className="fa fa-plus" /> Add API Key
          </button>
        </div>

        {this.renderAddApiKeyForm()}

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
                return (
                  <tr key={key.id}>
                    <td>{key.name}</td>
                    <td>{key.role}</td>
                    <td>
                      <DeleteButton onConfirmDelete={() => this.onDeleteApiKey(key)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ) : null}
        </table>
      </div>
    );
  }

  render() {
    const { hasFetched, navModel, apiKeysCount } = this.props;

    return (
      <div>
        <PageHeader model={navModel} />
        {hasFetched ? (
          apiKeysCount > 0 ? (
            this.renderApiKeyList()
          ) : (
            this.renderEmptyList()
          )
        ) : (
          <PageLoader pageName="Api keys" />
        )}
      </div>
    );
  }
}

function mapStateToProps(state) {
  return {
    navModel: getNavModel(state.navIndex, 'apikeys'),
    apiKeys: getApiKeys(state.apiKeys),
    searchQuery: state.apiKeys.searchQuery,
    apiKeysCount: getApiKeysCount(state.apiKeys),
    hasFetched: state.apiKeys.hasFetched,
  };
}

const mapDispatchToProps = {
  loadApiKeys,
  deleteApiKey,
  setSearchQuery,
  addApiKey,
};

export default hot(module)(connect(mapStateToProps, mapDispatchToProps)(ApiKeysPage));
