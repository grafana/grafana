import React, { PureComponent } from 'react';
//import '@emotion/react';
import { TabsBar, Tab, TabContent, IconName } from '@grafana/ui';
import { DataSourcePluginOptionsEditorProps, SelectableValue, KeyValue } from '@grafana/data';
import { DruidSettings, DruidSecureSettings } from './types';
import { DruidConnectionSettings } from './configuration/ConnectionSettings';
import { ConnectionSettingsOptions } from './configuration/ConnectionSettings/types';
import { DruidQueryDefaultSettings } from './configuration/QuerySettings';
import { QuerySettingsOptions } from './configuration/QuerySettings/types';

enum Tabs {
  Connection,
  Query,
}

interface Props extends DataSourcePluginOptionsEditorProps<DruidSettings, DruidSecureSettings> {}

interface State {
  activeTab: Tabs;
}

export class ConfigEditor extends PureComponent<Props, State> {
  state: State = {
    activeTab: Tabs.Connection,
  };

  normalizeData = (data: Record<string, any>, namespaced: boolean, namespace: string): object => {
    const keyPrefix = namespace + '.';
    const keys = Object.keys(data).filter((key) => {
      if (namespaced) {
        return !key.includes('.');
      } else {
        return key.startsWith(keyPrefix);
      }
    });
    if (keys.length === 0) {
      return {};
    }
    return keys
      .map((key, index) => {
        let newKey: string = keyPrefix + key;
        if (!namespaced) {
          newKey = key.replace(keyPrefix, '');
        }
        return { [newKey]: data[key] };
      })
      .reduce((acc, item) => {
        return { ...acc, ...item };
      });
  };

  onSelectTab = (item: SelectableValue<Tabs>) => {
    this.setState({ activeTab: item.value! });
  };

  onConnectionOptionsChange = (connectionSettingsOptions: ConnectionSettingsOptions) => {
    const { options, onOptionsChange } = this.props;
    const { settings, secretSettings, secretSettingsFields } = connectionSettingsOptions;
    const connectionSettings = this.normalizeData(settings, true, 'connection');
    const jsonData = { ...options.jsonData, ...connectionSettings };
    const connectionSecretSettings = this.normalizeData(secretSettings, true, 'connection');
    const secureJsonData = { ...options.secureJsonData, ...connectionSecretSettings };
    const connectionSecretSettingsFields = this.normalizeData(
      secretSettingsFields,
      true,
      'connection'
    ) as KeyValue<boolean>;
    const secureJsonFields = { ...options.secureJsonFields, ...connectionSecretSettingsFields };
    onOptionsChange({ ...options, jsonData, secureJsonData, secureJsonFields });
  };

  onQueryOptionsChange = (querySettingsOptions: QuerySettingsOptions) => {
    const { onOptionsChange, options } = this.props;
    const { settings } = querySettingsOptions;
    const querySettings = this.normalizeData(settings, true, 'query');
    const jsonData = { ...options.jsonData, ...querySettings };
    onOptionsChange({ ...options, jsonData });
  };

  connectionOptions = (): ConnectionSettingsOptions => {
    const { jsonData, secureJsonData, secureJsonFields } = this.props.options;
    return {
      settings: this.normalizeData(jsonData, false, 'connection'),
      secretSettings: this.normalizeData(secureJsonData || {}, false, 'connection'),
      secretSettingsFields: this.normalizeData(secureJsonFields || {}, false, 'connection') as KeyValue<boolean>,
    };
  };

  queryOptions = (): QuerySettingsOptions => {
    const { jsonData } = this.props.options;
    return {
      settings: this.normalizeData(jsonData, false, 'query'),
    };
  };

  render() {
    const connectionOptions = this.connectionOptions();
    const queryOptions = this.queryOptions();

    const ConnectionTab = {
      label: 'Connection',
      value: Tabs.Connection,
      content: <DruidConnectionSettings options={connectionOptions} onOptionsChange={this.onConnectionOptionsChange} />,
      icon: 'signal',
    };
    const QueryTab = {
      label: 'Query defaults',
      value: Tabs.Query,
      content: <DruidQueryDefaultSettings options={queryOptions} onOptionsChange={this.onQueryOptionsChange} />,
      icon: 'database',
    };

    const tabs = [ConnectionTab, QueryTab];
    const { activeTab } = this.state;

    return (
      <>
        <TabsBar>
          {tabs.map((t) => (
            <Tab
              key={t.value}
              label={t.label}
              active={t.value === activeTab}
              onChangeTab={() => this.onSelectTab(t)}
              icon={t.icon as IconName}
            />
          ))}
        </TabsBar>
        <TabContent>{tabs.find((t) => t.value === activeTab)?.content}</TabContent>
      </>
    );
  }
}
