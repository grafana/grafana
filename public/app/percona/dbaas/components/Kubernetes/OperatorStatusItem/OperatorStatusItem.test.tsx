import { mount } from 'enzyme';
import React from 'react';

import { Databases } from 'app/percona/shared/core';

import { KubernetesOperatorStatus } from './KubernetesOperatorStatus/KubernetesOperatorStatus.types';
import { OperatorStatusItem } from './OperatorStatusItem';

describe('OperatorStatusItem::', () => {
  it('renders', () => {
    const root = mount(
      <OperatorStatusItem databaseType={Databases.mysql} operator={{ status: KubernetesOperatorStatus.ok }} />
    );

    expect(root.text()).toContain('PXC');
    expect(root.text()).toContain('Installed');
  });
});
