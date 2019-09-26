import React from 'react';
import { DatasourceHttpSettingsBaseProps } from './types';
import { Switch } from '../Switch/Switch';

export const DatasourceHttpProxySettings: React.FC<DatasourceHttpSettingsBaseProps> = ({
  datasourceConfig,
  onChange,
}) => {
  return (
    <>
      <div className="gf-form-inline">
        <Switch
          label="TLS Client Auth"
          labelClass="width-13"
          checked={datasourceConfig.jsonData.tlsAuth}
          onChange={event => onChange({ ...datasourceConfig.jsonData, tlsAuth: event!.currentTarget.checked })}
        />

        <Switch
          label="With CA Cert"
          labelClass="width-13"
          checked={datasourceConfig.jsonData.tlsAuthWithCACert}
          onChange={event =>
            onChange({ ...datasourceConfig.jsonData, tlsAuthWithCACert: event!.currentTarget.checked })
          }
          tooltip="Needed forverifing self-signed TLS Certs"
        />
      </div>
      <div className="gf-form-inline">
        <Switch
          label="Skip TLS Verify"
          labelClass="width-13"
          checked={datasourceConfig.jsonData.tlsSkipVerify}
          onChange={event => onChange({ ...datasourceConfig.jsonData, tlsSkipVerify: event!.currentTarget.checked })}
        />
      </div>
      <div className="gf-form-inline">
        <Switch
          label="Forward OAuth Identity"
          labelClass="width-13"
          checked={datasourceConfig.jsonData.oauthPassThru}
          onChange={event => onChange({ ...datasourceConfig.jsonData, oauthPassThru: event!.currentTarget.checked })}
          tooltip="Forward the user's upstream OAuth identity to the datasource (Their access token gets passed along)."
        />
      </div>
    </>
  );
};
