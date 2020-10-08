import React, { PureComponent } from 'react';
import { css } from 'emotion';
import { Select, FeatureInfoBox, Label, stylesFactory } from '@grafana/ui';
import {
  LiveChannelScope,
  LiveChannelAddress,
  LiveChannelSupport,
  LiveChannelConfig,
  SelectableValue,
  StandardEditorProps,
  FeatureState,
  GrafanaTheme,
} from '@grafana/data';

import { LivePanelOptions } from './types';
import { getGrafanaLiveCentrifugeSrv } from 'app/features/live/live';
import { config } from 'app/core/config';

type Props = StandardEditorProps<LiveChannelAddress, any, LivePanelOptions>;

const scopes: Array<SelectableValue<LiveChannelScope>> = [
  { label: 'Grafana', value: LiveChannelScope.Grafana, description: 'Core grafana live features' },
  { label: 'Data Sources', value: LiveChannelScope.DataSource, description: 'Data sources with live support' },
  { label: 'Plugins', value: LiveChannelScope.Plugin, description: 'Plugins with live support' },
];

interface State {
  namespaces: Array<SelectableValue<string>>;
  paths: Array<SelectableValue<string>>;
  support?: LiveChannelSupport;
  config?: LiveChannelConfig;
}

export class LiveChannelEditor extends PureComponent<Props, State> {
  state: State = {
    namespaces: [],
    paths: [],
  };

  async componentDidMount() {
    this.updateSelectOptions();
  }

  async componentDidUpdate(oldProps: Props) {
    if (this.props.value !== oldProps.value) {
      this.updateSelectOptions();
    }
  }

  async updateSelectOptions() {
    const { scope, namespace, path } = this.props.value;
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

  onScopeChanged = (v: SelectableValue<LiveChannelScope>) => {
    if (v.value) {
      this.props.onChange({ scope: v.value } as LiveChannelAddress);
    }
  };

  onNamespaceChanged = (v: SelectableValue<string>) => {
    const update = {
      scope: this.props.value?.scope,
    } as LiveChannelAddress;
    if (v.value) {
      update.namespace = v.value;
    }
    this.props.onChange(update);
  };

  onPathChanged = (v: SelectableValue<string>) => {
    const { value, onChange } = this.props;
    const update = {
      scope: value.scope,
      namespace: value.namespace,
    } as LiveChannelAddress;
    if (v.value) {
      update.path = v.value;
    }
    onChange(update);
  };

  render() {
    const { namespaces, paths } = this.state;
    const { scope, namespace, path } = this.props.value;
    const style = getStyles(config.theme);

    return (
      <>
        <FeatureInfoBox title="Grafana Live" featureState={FeatureState.alpha}>
          <p>
            This supports real-time event streams in grafana core. This feature is under heavy development. Expect the
            intefaces and structures to change as this becomes more production ready.
          </p>
        </FeatureInfoBox>

        <div>
          <div className={style.dropWrap}>
            <Label>Scope</Label>
            <Select options={scopes} value={scopes.find(s => s.value === scope)} onChange={this.onScopeChanged} />
          </div>

          {scope && (
            <div className={style.dropWrap}>
              <Label>Namespace</Label>
              <Select
                options={namespaces}
                value={namespaces.find(s => s.value === namespace) || namespace || ''}
                onChange={this.onNamespaceChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
              />
            </div>
          )}

          {scope && namespace && (
            <div className={style.dropWrap}>
              <Label>Path</Label>
              <Select
                options={paths}
                value={paths.find(s => s.value === path) || path || ''}
                onChange={this.onPathChanged}
                allowCustomValue={true}
                backspaceRemovesValue={true}
              />
            </div>
          )}
        </div>
      </>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  dropWrap: css`
    margin-bottom: ${theme.spacing.sm};
  `,
}));
