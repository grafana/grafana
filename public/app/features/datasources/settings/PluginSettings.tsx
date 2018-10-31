import React, { PureComponent } from 'react';
import { DataSource, Plugin } from 'app/types/';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

interface Props {
  dataSource: DataSource;
  dataSourceMeta: Plugin;
}

export class PluginSettings extends PureComponent<Props> {
  element: any;
  component: AngularComponent;

  componentDidMount() {
    const { dataSource, dataSourceMeta } = this.props;

    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="datasource-config-ctrl" />';
    const scopeProps = {
      ctrl: {
        datasourceMeta: dataSourceMeta,
        current: dataSource,
      },
    };

    this.component = loader.load(this.element, scopeProps, template);
  }

  render() {
    return <div ref={element => (this.element = element)} />;
  }
}

export default PluginSettings;
