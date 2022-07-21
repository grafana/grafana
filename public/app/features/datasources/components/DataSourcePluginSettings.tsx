import { cloneDeep } from 'lodash';
import React, { PureComponent } from 'react';

import { DataSourcePluginMeta, DataSourceSettings } from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';

import { GenericDataSourcePlugin } from '../types';

export interface Props {
  plugin: GenericDataSourcePlugin;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  onModelChange: (dataSource: DataSourceSettings) => void;
}

export class DataSourcePluginSettings extends PureComponent<Props> {
  element: HTMLDivElement | null = null;
  component?: AngularComponent;
  scopeProps: {
    ctrl: { datasourceMeta: DataSourcePluginMeta; current: DataSourceSettings };
    onModelChanged: (dataSource: DataSourceSettings) => void;
  };

  constructor(props: Props) {
    super(props);

    this.scopeProps = {
      ctrl: { datasourceMeta: props.dataSourceMeta, current: cloneDeep(props.dataSource) },
      onModelChanged: this.onModelChanged,
    };
    this.onModelChanged = this.onModelChanged.bind(this);
  }

  componentDidMount() {
    const { plugin } = this.props;

    if (!this.element) {
      return;
    }

    if (!plugin.components.ConfigEditor) {
      // React editor is not specified, let's render angular editor
      // How to approach this better? Introduce ReactDataSourcePlugin interface and typeguard it here?
      const loader = getAngularLoader();
      const template = '<plugin-component type="datasource-config-ctrl" />';

      this.component = loader.load(this.element, this.scopeProps, template);
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { plugin } = this.props;
    if (!plugin.components.ConfigEditor && this.props.dataSource !== prevProps.dataSource) {
      this.scopeProps.ctrl.current = cloneDeep(this.props.dataSource);

      this.component?.digest();
    }
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  onModelChanged = (dataSource: DataSourceSettings) => {
    this.props.onModelChange(dataSource);
  };

  render() {
    const { plugin, dataSource } = this.props;

    if (!plugin) {
      return null;
    }

    return (
      <div ref={(element) => (this.element = element)}>
        {plugin.components.ConfigEditor &&
          React.createElement(plugin.components.ConfigEditor, {
            options: dataSource,
            onOptionsChange: this.onModelChanged,
          })}
      </div>
    );
  }
}
