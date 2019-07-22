// Libraries
import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { DataSourcePluginOptionsEditorProps, Switch } from '@grafana/ui';
import AzureMonitorDatasource from './azure_monitor/azure_monitor_datasource';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { getBackendSrv } from 'app/core/services/backend_srv';

export interface CloudOption {
  value: string;
  label: string;
}

type Props = DataSourcePluginOptionsEditorProps<any>; //DataSourceSettings doesn't define jsonData

export interface State {
  current: any;
  azureClouds: CloudOption[];
  subscriptions: [];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;
    console.log('init', options);

    options.jsonData.cloudName = options.jsonData.cloudName || 'azuremonitor';
    options.jsonData.azureLogAnalyticsSameAs = options.jsonData.azureLogAnalyticsSameAs || true;

    if (!options.hasOwnProperty('secureJsonData')) {
      options.secureJsonData = { clientSecret: '' };
    }

    if (!options.hasOwnProperty('secureJsonFields')) {
      options.secureJsonFields = { clientSecret: false };
    }

    this.state = {
      current: options,
      azureClouds: [
        { value: 'azuremonitor', label: 'Azure' },
        { value: 'govazuremonitor', label: 'Azure US Government' },
        { value: 'germanyazuremonitor', label: 'Azure Germany' },
        { value: 'chinaazuremonitor', label: 'Azure China' },
      ],
      subscriptions: [],
    };
  }

  azureMonitorDatasource = null;

  updateDatasource = () => {
    const datasource = this.state.current;
    if (!datasource.secureJsonData.clientSecret) {
      delete datasource.secureJsonData;
    }

    console.log('here', this.state.current, datasource);

    this.props.onOptionsChange(datasource);
  };

  onAzureCloudSelect = (cloudName: SelectableValue<string>) => {
    this.setState({
      current: { ...this.state.current, jsonData: { ...this.state.current.jsonData, cloudName } },
    });

    this.updateDatasource();
  };

  onTenantIdChange = (tenantId: string) => {
    this.setState({
      current: { ...this.state.current, jsonData: { ...this.state.current.jsonData, tenantId } },
    });

    this.updateDatasource();
  };

  onClientIdChange = (clientId: string) => {
    this.setState({
      current: { ...this.state.current, jsonData: { ...this.state.current.jsonData, clientId } },
    });

    this.updateDatasource();
  };

  onClientSecretChange = (clientSecret: string) => {
    this.setState({
      current: {
        ...this.state.current,
        secureJsonData: { ...this.state.current.secureJsonData, clientSecret },
      },
    });

    this.updateDatasource();
  };

  onResetClientSecret = () => {
    this.setState({
      current: {
        ...this.state.current,
        secureJsonFields: { ...this.state.current.secureJsonFields, clientSecret: false },
      },
    });

    this.updateDatasource();
  };

  onLoadSubscriptions = async () => {
    await getBackendSrv()
      .put(`/api/datasources/${this.state.current.id}`, this.state.current)
      .then(() => {
        // this.updateDatasource();
        this.setState({
          current: {
            ...this.state.current,
            version: this.state.current.version + 1,
          },
        });
        this.getSubscriptions();
      });
  };

  getSubscriptions = async () => {
    // todo: validate

    const datasource = this.state.current;
    if (datasource.secureJsonData) {
      datasource.secureJsonData = {};
    }
    console.log(datasource);

    this.azureMonitorDatasource = new AzureMonitorDatasource(datasource, getBackendSrv(), new TemplateSrv());

    const subscriptions = (await this.azureMonitorDatasource.getSubscriptions()) || [];
    console.log(subscriptions);
    if (subscriptions && subscriptions.length > 0) {
      this.setState({
        subscriptions,
        current: {
          ...this.state.current,
          jsonData: {
            ...this.state.current.jsonData,
            subscriptionId: this.state.current.jsonData.subscriptionId || subscriptions[0].value,
          },
        },
      });
    }
  };

  // async getSubscriptions() {
  //   if (!this.hasNecessaryCredentials()) {
  //     return [];
  //   }
  //   this.subscriptions = (await this.azureMonitorDatasource.getSubscriptions()) || [];
  //   if (this.subscriptions && this.subscriptions.length > 0) {
  //     this.current.jsonData.subscriptionId = this.current.jsonData.subscriptionId || this.subscriptions[0].value;
  //   }

  //   return this.subscriptions;
  // }

  onAzureLogAnalyticsSameAsChange = () => {
    this.setState({
      current: {
        ...this.state.current,
        jsonData: {
          ...this.state.current.jsonData,
          azureLogAnalyticsSameAs: !this.state.current.jsonData.azureLogAnalyticsSameAs,
        },
      },
    });

    this.updateDatasource();
  };

  render() {
    const { azureClouds, current } = this.state;
    return (
      <>
        <h3 className="page-heading">Azure Monitor Details</h3>
        <AzureCredentialsForm
          selectedAzureCloud={current.jsonData.cloudName}
          azureCloudOptions={azureClouds}
          tenantId={current.jsonData.tenantId}
          clientId={current.jsonData.clientId}
          clientSecret={current.secureJsonData.clientSecret}
          clientSecretConfigured={current.secureJsonFields.clientSecret}
          onAzureCloudChange={this.onAzureCloudSelect}
          onTenantIdChange={this.onTenantIdChange}
          onClientIdChange={this.onClientIdChange}
          onClientSecretChange={this.onClientSecretChange}
          onResetClientSecret={this.onResetClientSecret}
          onLoadSubscriptions={this.onLoadSubscriptions}
        />

        <h3 className="page-heading">Azure Log Analytics API Details</h3>
        <Switch
          label="Same details as Azure Monitor API"
          checked={current.jsonData.azureLogAnalyticsSameAs}
          onChange={this.onAzureLogAnalyticsSameAsChange}
        />

        {!current.jsonData.azureLogAnalyticsSameAs && <h2>HI</h2>}
      </>
    );
  }
}
