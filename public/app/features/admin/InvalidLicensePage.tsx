import React, { PureComponent } from 'react';
import Page from 'app/core/components/Page/Page';
import { getWarningNav } from 'app/core/nav_model_srv';

interface Props {}

export class InvalidLicensePage extends PureComponent<Props> {
  render() {
    const navModel = getWarningNav('License invalid', 'The Grafana Enterprise license is not valid');

    return (
      <Page navModel={navModel}>
        <Page.Contents>
          <h2 className="page-heading">Enterprise License Expired</h2>
          <p>Please update your license file or remove it to restore access to your Grafana server.</p>
        </Page.Contents>
      </Page>
    );
  }
}
