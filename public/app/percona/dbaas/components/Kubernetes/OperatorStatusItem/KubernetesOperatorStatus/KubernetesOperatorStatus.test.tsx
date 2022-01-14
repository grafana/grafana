import React from 'react';
import { shallow } from 'enzyme';
import { Databases } from 'app/percona/shared/core';
import { dataQa } from '@percona/platform-core';
import { KubernetesOperatorStatus as Status } from './KubernetesOperatorStatus.types';
import { KubernetesOperatorStatus } from './KubernetesOperatorStatus';

describe('DBClusterStatus::', () => {
  it('renders correctly when active', () => {
    const root = shallow(<KubernetesOperatorStatus status={Status.ok} databaseType={Databases.mongodb} />);

    expect(root.find('[data-qa="cluster-status-ok"]')).toBeTruthy();
  });
  it('renders installation link when unavailable', () => {
    const root = shallow(<KubernetesOperatorStatus status={Status.unavailable} databaseType={Databases.mongodb} />);

    expect(root.find('[data-qa="cluster-status-failse"]')).toBeTruthy();
    expect(root.find(dataQa('cluster-install-doc-link'))).toBeTruthy();
  });
});
