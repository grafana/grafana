import React, { PureComponent } from 'react';
import { hot } from 'react-hot-loader';
import { connect } from 'react-redux';
import { css } from 'emotion';
import { StoreState } from 'app/types';
import { getNavModel } from 'app/core/selectors/navModel';
import Page from 'app/core/components/Page/Page';
import {
  NavModel,
  SelectableValue,
  FeatureState,
  LiveChannelScope,
  LiveChannelConfig,
  LiveChannelSupport,
} from '@grafana/data';
import { LivePanel } from './LivePanel';
import { Select, FeatureInfoBox, Container } from '@grafana/ui';
import { getGrafanaLiveCentrifugeSrv } from '../live/live';

interface Props {
  navModel: NavModel;
}

const scopes: Array<SelectableValue<LiveChannelScope>> = [
  { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
  { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
  { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
];

interface State {
  scope: LiveChannelScope;
  namespace?: string;
  path?: string;

  namespaces: Array<SelectableValue<string>>;
  paths: Array<SelectableValue<string>>;
  support?: LiveChannelSupport;
  config?: LiveChannelConfig;
}

export class LiveAdmin extends PureComponent<Props, State> {
  state: State = {
    scope: LiveChannelScope.Grafana,
    namespace: 'testdata',
    path: 'random-2s-stream',
    namespaces: [],
    paths: [],
  };
  // onTextChanged: ((event: FormEvent<HTMLInputElement>) => void) | undefined;
  // onPublish: ((event: MouseEvent<HTMLButtonElement, MouseEvent>) => void) | undefined;

  async componentDidMount() {
    const { scope, namespace, path } = this.state;
    const srv = getGrafanaLiveCentrifugeSrv();
    const namespaces = await srv.scopes[scope].listNamespaces();
    const support = namespace ? await srv.scopes[scope].getChannelSupport(namespace) : undefined;
    const paths = support ? await support.getSupportedPaths() : undefined;
    const config = support && path ? await support.getChannelConfig(path) : undefined;

    this.setState({
      namespaces,
      support,
      paths: paths
        ? paths.map(p => ({
            label: p.path,
            value: p.path,
            description: p.description,
          }))
        : [],
      config,
    });
  }

  onScopeChanged = async (v: SelectableValue<LiveChannelScope>) => {
    if (v.value) {
      const srv = getGrafanaLiveCentrifugeSrv();

      this.setState({
        scope: v.value,
        namespace: undefined,
        path: undefined,
        namespaces: await srv.scopes[v.value!].listNamespaces(),
        paths: [],
        support: undefined,
        config: undefined,
      });
    }
  };

  onNamespaceChanged = async (v: SelectableValue<string>) => {
    if (v.value) {
      const namespace = v.value;
      const srv = getGrafanaLiveCentrifugeSrv();
      const support = await srv.scopes[this.state.scope].getChannelSupport(namespace);

      this.setState({
        namespace: v.value,
        paths: support!.getSupportedPaths().map(p => ({
          label: p.path,
          value: p.path,
          description: p.description,
        })),
        path: undefined,
        config: undefined,
      });
    }
  };

  onPathChanged = async (v: SelectableValue<string>) => {
    if (v.value) {
      const path = v.value;
      const srv = getGrafanaLiveCentrifugeSrv();
      const support = await srv.scopes[this.state.scope].getChannelSupport(this.state.namespace!);
      if (!support) {
        this.setState({
          namespace: undefined,
          paths: [],
          config: undefined,
          support,
        });
        return;
      }

      this.setState({
        path,
        support,
        config: support.getChannelConfig(path),
      });
    }
  };

  render() {
    const { navModel } = this.props;
    const { scope, namespace, namespaces, path, paths, config } = this.state;

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <Container grow={1}>
            <FeatureInfoBox
              title="Grafana Live"
              featureState={FeatureState.alpha}
              // url={getDocsLink(DocsId.Transformations)}
            >
              <p>
                This supports real-time event streams in grafana core. This feature is under heavy development. Expect
                the intefaces and structures to change as this becomes more production ready.
              </p>
            </FeatureInfoBox>
            <br />
            <br />
          </Container>

          <div
            className={css`
              width: 100%;
              display: flex;
              > div {
                margin-right: 8px;
                min-width: 150px;
              }
            `}
          >
            <div>
              <h5>Scope</h5>
              <Select options={scopes} value={scopes.find(s => s.value === scope)} onChange={this.onScopeChanged} />
            </div>
            <div>
              <h5>Namespace</h5>
              <Select
                options={namespaces}
                value={namespaces.find(s => s.value === namespace) || namespace || ''}
                onChange={this.onNamespaceChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
              />
            </div>
            <div>
              <h5>Path</h5>
              <Select
                options={paths}
                value={paths.find(s => s.value === path) || path || ''}
                onChange={this.onPathChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
              />
            </div>
          </div>
          <br />
          <br />
          {scope && namespace && path && <LivePanel scope={scope} namespace={namespace} path={path} config={config} />}
        </Page.Contents>
      </Page>
    );
  }
}

const mapStateToProps = (state: StoreState) => ({
  navModel: getNavModel(state.navIndex, 'live'),
});

export default hot(module)(connect(mapStateToProps)(LiveAdmin));
