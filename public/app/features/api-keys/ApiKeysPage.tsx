import React, { PureComponent } from 'react';
import ReactDOMServer from 'react-dom/server';
import { connect, ConnectedProps } from 'react-redux';
import { hot } from 'react-hot-loader';
// Utils
import { ApiKey, CoreEvents, NewApiKey, StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import { getApiKeys, getApiKeysCount } from './state/selectors';
import { addApiKey, deleteApiKey, loadApiKeys } from './state/actions';
import Page from 'app/core/components/Page/Page';
import ApiKeysAddedModal from './ApiKeysAddedModal';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import EmptyListCTA from 'app/core/components/EmptyListCTA/EmptyListCTA';
import { LegacyForms } from '@grafana/ui';
import { rangeUtil } from '@grafana/data';
import { getTimeZone } from 'app/features/profile/state/selectors';
import { setSearchQuery } from './state/reducers';
import { ApiKeysForm } from './ApiKeysForm';
import { ApiKeysActionBar } from './ApiKeysActionBar';
import { ApiKeysTable } from './ApiKeysTable';
import { ApiKeysController } from './ApiKeysController';

const { Switch } = LegacyForms;

function mapStateToProps(state: StoreState) {
  return {
    navModel: getNavModel(state.navIndex, 'apikeys'),
    apiKeys: getApiKeys(state.apiKeys),
    searchQuery: state.apiKeys.searchQuery,
    apiKeysCount: getApiKeysCount(state.apiKeys),
    hasFetched: state.apiKeys.hasFetched,
    timeZone: getTimeZone(state.user),
  };
}

const mapDispatchToProps = {
  loadApiKeys,
  deleteApiKey,
  setSearchQuery,
  addApiKey,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

interface OwnProps {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

interface State {
  includeExpired: boolean;
  hasFetched: boolean;
}

export class ApiKeysPageUnconnected extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { includeExpired: false, hasFetched: false };
  }

  componentDidMount() {
    this.fetchApiKeys();
  }

  async fetchApiKeys() {
    await this.props.loadApiKeys(this.state.includeExpired);
  }

  onDeleteApiKey = (key: ApiKey) => {
    this.props.deleteApiKey(key.id!, this.state.includeExpired);
  };

  onSearchQueryChange = (value: string) => {
    this.props.setSearchQuery(value);
  };

  onIncludeExpiredChange = (event: React.SyntheticEvent<HTMLInputElement>) => {
    this.setState({ hasFetched: false, includeExpired: event.currentTarget.checked }, this.fetchApiKeys);
  };

  onAddApiKey = (newApiKey: NewApiKey) => {
    const openModal = (apiKey: string) => {
      const rootPath = window.location.origin + config.appSubUrl;
      const modalTemplate = ReactDOMServer.renderToString(<ApiKeysAddedModal apiKey={apiKey} rootPath={rootPath} />);

      appEvents.emit(CoreEvents.showModal, {
        templateHtml: modalTemplate,
      });
    };

    const secondsToLive = newApiKey.secondsToLive;
    try {
      const secondsToLiveAsNumber = secondsToLive ? rangeUtil.intervalToSeconds(secondsToLive) : null;
      const apiKey: ApiKey = {
        ...newApiKey,
        secondsToLive: secondsToLiveAsNumber,
      };
      this.props.addApiKey(apiKey, openModal, this.state.includeExpired);
      this.setState((prevState: State) => {
        return {
          ...prevState,
          isAdding: false,
        };
      });
    } catch (err) {
      console.error(err);
    }
  };

  render() {
    const { hasFetched, navModel, apiKeysCount, apiKeys, searchQuery, timeZone } = this.props;
    const { includeExpired } = this.state;

    if (!hasFetched) {
      return (
        <Page navModel={navModel}>
          <Page.Contents isLoading={true}>{}</Page.Contents>
        </Page>
      );
    }

    return (
      <Page navModel={navModel}>
        <Page.Contents isLoading={false}>
          <ApiKeysController>
            {({ isAdding, toggleIsAdding }) => {
              const showCTA = !isAdding && apiKeysCount === 0;
              const showTable = apiKeysCount > 0;
              return (
                <>
                  {showCTA ? (
                    <EmptyListCTA
                      title="You haven't added any API Keys yet."
                      buttonIcon="key-skeleton-alt"
                      buttonLink="#"
                      onClick={toggleIsAdding}
                      buttonTitle="New API Key"
                      proTip="Remember you can provide view-only API access to other applications."
                    />
                  ) : null}
                  {showTable ? (
                    <ApiKeysActionBar
                      searchQuery={searchQuery}
                      disabled={isAdding}
                      onAddClick={toggleIsAdding}
                      onSearchChange={this.onSearchQueryChange}
                    />
                  ) : null}
                  <ApiKeysForm show={isAdding} onClose={toggleIsAdding} onKeyAdded={this.onAddApiKey} />
                  {showTable ? (
                    <>
                      <h3 className="page-heading">Existing Keys</h3>
                      <Switch label="Show expired" checked={includeExpired} onChange={this.onIncludeExpiredChange} />
                      <ApiKeysTable apiKeys={apiKeys} timeZone={timeZone} onDelete={this.onDeleteApiKey} />
                    </>
                  ) : null}
                </>
              );
            }}
          </ApiKeysController>
        </Page.Contents>
      </Page>
    );
  }
}

const ApiKeysPage = connector(ApiKeysPageUnconnected);
export default hot(module)(ApiKeysPage);
