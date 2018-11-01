import React, { PureComponent } from 'react';
import _ from 'lodash';
import { DataSource, Plugin } from 'app/types/';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

interface Props {
  dataSource: DataSource;
  dataSourceMeta: Plugin;
  onModelChange: (dataSource: DataSource) => void;
}

export class PluginSettings extends PureComponent<Props> {
  element: any;
  component: AngularComponent;
  scopeProps: {
    ctrl: { datasourceMeta: Plugin; current: DataSource };
    onModelChanged: (dataSource: DataSource) => void;
  };

  constructor(props) {
    super(props);

    this.scopeProps = {
      ctrl: { datasourceMeta: props.dataSourceMeta, current: _.cloneDeep(props.dataSource) },
      onModelChanged: this.onModelChanged,
    };
  }

  componentDidMount() {
    if (!this.element) {
      return;
    }

    const loader = getAngularLoader();
    const template = '<plugin-component type="datasource-config-ctrl" />';

    this.component = loader.load(this.element, this.scopeProps, template);
  }

  componentDidUpdate(prevProps) {
    if (this.props.dataSource !== prevProps.dataSource) {
      this.scopeProps.ctrl.current = _.cloneDeep(this.props.dataSource);
    }
  }

  componentWillUnmount() {
    if (this.component) {
      this.component.destroy();
    }
  }

  onModelChanged = (dataSource: DataSource) => {
    this.props.onModelChange(dataSource);
  };

  render() {
    return <div ref={element => (this.element = element)} />;
  }
}

export default PluginSettings;
