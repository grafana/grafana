// Libraries
import React, { PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { DataSourcePluginOptionsEditorProps } from '@grafana/ui';
import { AzureCredentialsForm } from './AzureCredentialsForm';

export interface CloudOption {
  value: string;
  label: string;
}

type Props = DataSourcePluginOptionsEditorProps<any>; //DataSourceSettings doesn't define jsonData

export interface State {
  current: any;
  azureClouds: CloudOption[];
}

export class ConfigEditor extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { options } = this.props;

    this.state = {
      current: options,
      azureClouds: [
        { value: 'azuremonitor', label: 'Azure' },
        { value: 'govazuremonitor', label: 'Azure US Government' },
        { value: 'germanyazuremonitor', label: 'Azure Germany' },
        { value: 'chinaazuremonitor', label: 'Azure China' },
      ],
    };
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    console.log('next', nextProps);
    nextProps.options.jsonData.cloudName = nextProps.options.jsonData.cloudName || 'azuremonitor';
    nextProps.options.jsonData.azureLogAnalyticsSameAs = nextProps.options.jsonData.azureLogAnalyticsSameAs || true;
    // nextProps.options.secureJsonData = nextProps.options.secureJsonData || { clientSecret: '' };
    // nextProps.options.secureJsonFields = nextProps.options.secureJsonFields || {};

    if (!nextProps.options.hasOwnProperty('secureJsonData')) {
      // debugger;
      nextProps.options.secureJsonData = { clientSecret: '' };
    }

    // if (!('secureJsonData' in nextProps.options)) {
    //   nextProps.options.secureJsonData = { clientSecret: '' };
    // }

    console.log('UPDATED');
    return { current: nextProps.options };
  }

  updateDatasource = () => {
    if (!this.state.current.secureJsonData.clientSecret) {
      console.log('was here too', this.state.current);
      this.state.current.secureJsonData = {};
    }

    console.log('updating...', this.state.current);
    this.props.onOptionsChange(this.state.current);
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
    console.log(clientSecret);
    // debugger;
    this.setState({
      current: {
        ...this.state.current,
        secureJsonData: { ...this.state.current.secureJsonData, clientSecret },
      },
    });
    console.log('after update', this.state.current);

    this.updateDatasource();
  };

  onResetClientSecret = () => {
    const current = this.state.current;
    current.secureJsonFields.clientSecret = false;
    this.setState({ current });
    this.updateDatasource();
  };

  render() {
    const { azureClouds, current } = this.state;
    const { options } = this.props;
    console.log('render', options);
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
        />
      </>
    );
  }
}
