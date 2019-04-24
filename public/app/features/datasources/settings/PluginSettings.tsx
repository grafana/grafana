import React, { PureComponent } from 'react';
import _ from 'lodash';
import { Plugin } from 'app/types';
import { DataSourceSettings, DataSourcePlugin } from '@grafana/ui/src/types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

export interface Props {
  plugin: DataSourcePlugin<any, any>;
  dataSource: DataSourceSettings;
  dataSourceMeta: Plugin;
  onModelChange: (dataSource: DataSourceSettings) => void;
}

export class PluginSettings extends PureComponent<Props> {
  element: any;
  component: AngularComponent;
  scopeProps: {
    ctrl: { datasourceMeta: Plugin; current: DataSourceSettings };
    onModelChanged: (dataSource: DataSourceSettings) => void;
  };

  constructor(props) {
    super(props);

    this.scopeProps = {
      ctrl: { datasourceMeta: props.dataSourceMeta, current: _.cloneDeep(props.dataSource) },
      onModelChanged: this.onModelChanged,
    };
    this.onModelChanged = this.onModelChanged.bind(this);
  }

  componentDidMount() {
    const { plugin } = this.props;

    if (!this.element) {
      return;
    }

    if (!plugin.editor) {
      // React editor is not specified, let's render angular editor
      // How to apprach this better? Introduce ReactDataSourcePlugin interface and typeguard it here?
      const loader = getAngularLoader();
      const template = '<plugin-component type="datasource-config-ctrl" />';

      this.component = loader.load(this.element, this.scopeProps, template);
    }
  }

  componentDidUpdate(prevProps) {
    if (!this.props.plugin.editor && this.props.dataSource !== prevProps.dataSource) {
      console.log('differ');
      this.scopeProps.ctrl.current = _.cloneDeep(this.props.dataSource);

      this.component.digest();
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
      <div ref={element => (this.element = element)}>
        {plugin.editor &&
          React.createElement(plugin.editor, {
            options: dataSource,
            onOptionsChange: this.onModelChanged,
          })}
      </div>
    );
  }
}

export default PluginSettings;
