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
  onTenantIdChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClientIdChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClientSecretChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onResetClientSecret: () => void;
  onLoadSubscriptions?: () => void;
}

export class AzureCredentialsForm extends PureComponent<Props> {
  render() {
    const {
      selectedAzureCloud,
      selectedSubscription,
      tenantId,
      clientId,
      clientSecret,
      clientSecretConfigured,
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
                  onChange={onTenantIdChange}
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
                  onChange={onClientIdChange}
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
                    onChange={onClientSecretChange}
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
