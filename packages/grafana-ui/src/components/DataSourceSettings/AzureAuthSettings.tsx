import React, { FunctionComponent } from 'react';
import { AzureCredentials } from './AzureCredentials';
import { AzureCredentialsForm } from './AzureCredentialsForm';
import { HttpSettingsBaseProps } from './types';

export interface Props extends HttpSettingsBaseProps {}

export const AzureAuthSettings: FunctionComponent<Props> = (props: Props) => {
  const credentials: AzureCredentials = {
    authType: 'msi',
  };

  const onCredentialsChange = () => {
    // Nothing
  };

  return (
    <>
      <h6>Azure Authentication</h6>
      <div className="gf-form-group">
        <AzureCredentialsForm
          managedIdentityEnabled={true}
          credentials={credentials}
          onCredentialsChange={onCredentialsChange}
        />
      </div>
    </>
  );
};

export default AzureAuthSettings;
