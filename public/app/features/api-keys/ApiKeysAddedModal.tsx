import React from 'react';
import { Icon } from '@grafana/ui';

export interface Props {
  apiKey: string;
  rootPath: string;
}

export const ApiKeysAddedModal = (props: Props) => {
  return (
    <div className="modal-body">
      <div className="modal-header">
        <h2 className="modal-header-title">
          <Icon name="key-skeleton-alt" size="lg" />
          <span className="p-l-1">API Key Created</span>
        </h2>

        <a className="modal-header-close" ng-click="dismiss();">
          <Icon name="times" />
        </a>
      </div>

      <div className="modal-content">
        <div className="gf-form-group">
          <div className="gf-form">
            <span className="gf-form-label">Key</span>
            <span className="gf-form-label">{props.apiKey}</span>
          </div>
        </div>

        <div className="grafana-info-box" style={{ border: 0 }}>
          You will only be able to view this key here once! It is not stored in this form. So be sure to copy it now.
          <br />
          <br />
          You can authenticate request using the Authorization HTTP header, example:
          <br />
          <br />
          <pre className="small">
            curl -H "Authorization: Bearer {props.apiKey}" {props.rootPath}/api/dashboards/home
          </pre>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysAddedModal;
