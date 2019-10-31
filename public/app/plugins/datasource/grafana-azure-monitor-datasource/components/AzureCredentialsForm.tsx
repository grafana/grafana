import React, { ChangeEvent, PureComponent } from 'react';
import { SelectableValue } from '@grafana/data';
import { Input, FormLabel, Select, Button } from '@grafana/ui';

export interface Props {
  selectedAzureCloud?: string;
  selectedSubscription?: string;
  azureCloudOptions?: SelectableValue[];
  tenantId: string;
  clientId: string;
  clientSecret: string;
  clientSecretConfigured: boolean;
  subscriptionOptions?: SelectableValue[];
  onAzureCloudChange?: (value: SelectableValue<string>) => void;
  onSubscriptionSelectChange?: (value: SelectableValue<string>) => void;
  onTenantIdChange: (tenantId: string) => void;
  onClientIdChange: (clientId: string) => void;
  onClientSecretChange: (clientSecret: string) => void;
  onResetClientSecret: () => void;
  onLoadSubscriptions?: () => void;
}

export interface State {
  selectedAzureCloud?: string;
  selectedSubscription: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  clientSecretConfigured: boolean;
}

export class AzureCredentialsForm extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const {
      selectedAzureCloud,
      selectedSubscription,
      tenantId,
      clientId,
      clientSecret,
      clientSecretConfigured,
    } = this.props;

    this.state = {
      selectedAzureCloud,
      selectedSubscription,
      tenantId,
      clientId,
      clientSecret,
      clientSecretConfigured,
    };
  }

  static getDerivedStateFromProps(nextProps: Props, prevState: Props) {
    const { selectedAzureCloud, tenantId, clientId, clientSecret, clientSecretConfigured } = nextProps;
    return {
      selectedAzureCloud,
      tenantId,
      clientId,
      clientSecret,
      clientSecretConfigured,
    };
  }

  render() {
    const {
      azureCloudOptions,
      subscriptionOptions,
      onAzureCloudChange,
      onSubscriptionSelectChange,
      onTenantIdChange,
      onClientIdChange,
      onClientSecretChange,
      onResetClientSecret,
      onLoadSubscriptions,
    } = this.props;
    const {
      selectedAzureCloud,
      selectedSubscription,
      tenantId,
      clientId,
      clientSecret,
      clientSecretConfigured,
    } = this.state;
    const hasRequiredFields = tenantId && clientId && (clientSecret || clientSecretConfigured);
    const hasSubscriptions = onLoadSubscriptions && subscriptionOptions;
    return (
      <>
        <div className="gf-form-group">
          {azureCloudOptions && (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-12" tooltip="Choose an Azure Cloud.">
                  Azure Cloud
                </FormLabel>
                <Select
                  className="width-15"
                  value={azureCloudOptions.find(azureCloud => azureCloud.value === selectedAzureCloud)}
                  options={azureCloudOptions}
                  defaultValue={selectedAzureCloud}
                  onChange={onAzureCloudChange}
                />
              </div>
            </div>
          )}
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-12">Directory (tenant) ID</FormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={tenantId || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onTenantIdChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="gf-form-inline">
            <div className="gf-form">
              <FormLabel className="width-12">Application (client) ID</FormLabel>
              <div className="width-15">
                <Input
                  className="width-30"
                  placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                  value={clientId || ''}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => onClientIdChange(event.target.value)}
                />
              </div>
            </div>
          </div>
          {clientSecretConfigured ? (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-12">Client Secret</FormLabel>
                <Input className="width-25" placeholder="configured" disabled={true} />
              </div>
              <div className="gf-form">
                <div className="max-width-30 gf-form-inline">
                  <Button variant="secondary" type="button" onClick={onResetClientSecret}>
                    reset
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="gf-form-inline">
              <div className="gf-form">
                <FormLabel className="width-12">Client Secret</FormLabel>
                <div className="width-15">
                  <Input
                    className="width-30"
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    value={clientSecret || ''}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => onClientSecretChange(event.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
          {hasSubscriptions && (
            <>
              <div className="gf-form-inline">
                <div className="gf-form">
                  <FormLabel className="width-12">Default Subscription</FormLabel>
                  <div className="width-25">
                    <Select
                      value={subscriptionOptions.find(subscription => subscription.value === selectedSubscription)}
                      options={subscriptionOptions}
                      defaultValue={selectedSubscription}
                      onChange={onSubscriptionSelectChange}
                    />
                  </div>
                </div>
              </div>
              <div className="gf-form-inline">
                <div className="gf-form">
                  <div className="max-width-30 gf-form-inline">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={onLoadSubscriptions}
                      disabled={!hasRequiredFields}
                    >
                      Load Subscriptions
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </>
    );
  }
}

export default AzureCredentialsForm;
