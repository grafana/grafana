import React, { PureComponent } from 'react';
import _ from 'lodash';
import { Plugin } from 'app/types';
import { DataSourceSettings } from '@grafana/ui/src/types';
import { getAngularLoader, AngularComponent } from 'app/core/services/AngularLoader';

export interface Props {
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
    return <div ref={element => (this.element = element)} />;
  }
}

export default PluginSettings;
