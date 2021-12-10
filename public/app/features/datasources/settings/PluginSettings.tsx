import React, { PureComponent } from 'react';
import { cloneDeep } from 'lodash';
import {
  DataQuery,
  DataSourceApi,
  DataSourceJsonData,
  DataSourcePlugin,
  DataSourcePluginMeta,
  DataSourceSettings,
  LibraryCredential,
} from '@grafana/data';
import { AngularComponent, getAngularLoader } from '@grafana/runtime';
export type GenericDataSourcePlugin = DataSourcePlugin<DataSourceApi<DataQuery, DataSourceJsonData>>;
export interface Props {
  plugin: GenericDataSourcePlugin;
  dataSource: DataSourceSettings;
  dataSourceMeta: DataSourcePluginMeta;
  onModelChange: (dataSource: DataSourceSettings) => void;
}

export class PluginSettings extends PureComponent<Props> {
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
    this.maskMatchingLibCredentials();
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

  async maskMatchingLibCredentials() {
    const libraryCredential: LibraryCredential = {
      id: 123,
      uid: '123',
      orgId: 123,
      name: 'fake',
      type: 'http',
      jsonData: {
        keepCookies: ['test'],
        timeout: '10',
      },
      secureJsonFields: {},
      readOnly: true,
      url: 'URL',
      basicAuth: true,
      user: 'user',
      password: 'password',
    };
    // const libraryCredential = this.props.dataSource.libraryCredential;
    if (libraryCredential) {
      const elementsThatCanBeMasked = document.querySelectorAll('[data-lib-credential]');
      elementsThatCanBeMasked.forEach((elem) => {
        const propertyName = elem.getAttribute('data-lib-credential');
        if (propertyName) {
          const match =
            libraryCredential.jsonData[propertyName] ||
            libraryCredential.secureJsonFields[propertyName] ||
            (libraryCredential.secureJsonData && libraryCredential.secureJsonData[propertyName]) ||
            (libraryCredential as any)[propertyName];
          if (match) {
            // TODO: maybe we could do something better than just replace the node with a span.
            const span = document.createElement('span');
            span.innerText = `This item was set with a library credential: ${libraryCredential.name}`;
            span.style.border = 'solid';
            span.style.padding = '1px 3px';
            elem.replaceWith(span);
          }
        }
      });
    }
  }

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

export default PluginSettings;
