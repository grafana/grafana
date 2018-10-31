import _ from 'lodash';
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
  scopeProps: any;

  constructor(props) {
    super(props);

    this.scopeProps = {
      ctrl: {
        datasourceMeta: this.props.dataSourceMeta,
        current: this.props.dataSource,
      },
      onModelChanged: this.onModelChanged,
    };
  }

  componentDidUpdate() {
    this.scopeProps.ctrl.current = this.props.dataSource;
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="datasource-config-ctrl" />';

    this.component = loader.load(this.element, this.scopeProps, template);
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  onModelChanged(dataSource: DataSource) {
    console.log(dataSource);
  }

  render() {
    return <div ref={element => (this.element = element)} />;
  }
}

export default PluginSettings;
