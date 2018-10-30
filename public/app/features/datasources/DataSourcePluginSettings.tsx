import React, { PureComponent } from 'react';
import { DataSource, Plugin } from 'app/types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';
import { importPluginModule } from '../plugins/plugin_loader';
interface Props {
  dataSource: DataSource;
  dataSourceMeta: Plugin;
}

export class DataSourcePluginSettings extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  componentDidMount() {
    if (!this.element) {
      return;
    }

    importPluginModule(this.props.dataSourceMeta.module).then(pluginExports => {
      console.log(pluginExports);
    });

    const loader = getAngularLoader();
    const template = '<plugin-component type="datasource-config-ctrl" />';
    const scopeProps = {
      ctrl: {
        dataSourceMeta: this.props.dataSourceMeta,
        current: this.props.dataSource,
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  render() {
    return <div ref={element => (this.element = element)} />;
  }
}

export default DataSourcePluginSettings;
