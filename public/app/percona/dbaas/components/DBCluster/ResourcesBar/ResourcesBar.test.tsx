import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { ResourcesBar } from './ResourcesBar';
import { Messages } from './ResourcesBar.messages';
import { ResourcesUnits } from '../DBCluster.types';

describe('ResourcesBar::', () => {
  it('renders correctly with icon, allocated, expected and label', () => {
    const allocated = { value: 2, units: ResourcesUnits.GB, original: 2 };
    const total = { value: 10, units: ResourcesUnits.GB, original: 10 };
    const expected = { value: 2, units: ResourcesUnits.GB, original: 2 };
    const resourceLabel = 'Memory';
    const wrapper = mount(
      <ResourcesBar
        icon={<div>Test icon</div>}
        allocated={allocated}
        expected={expected}
        total={total}
        resourceLabel={resourceLabel}
      />
    );

    expect(wrapper.find(dataQa('resources-bar-icon')).text()).toEqual('Test icon');
    expect(wrapper.find(dataQa('resources-bar-label')).text()).toEqual(
      Messages.buildResourcesLabel(allocated, 20, total)
    );
    expect(wrapper.find(dataQa('resources-bar-allocated-caption')).text()).toEqual(
      Messages.buildAllocatedLabel(resourceLabel)
    );
    expect(wrapper.find(dataQa('resources-bar-expected-caption')).text()).toEqual(
      Messages.buildExpectedLabel(expected, resourceLabel)
    );
  });
  it('renders invalid message for insufficient resources', () => {
    const allocated = { value: 2, units: ResourcesUnits.GB, original: 2 };
    const total = { value: 10, units: ResourcesUnits.GB, original: 10 };
    const expected = { value: 20, units: ResourcesUnits.GB, original: 20 };
    const resourceLabel = 'Memory';
    const wrapper = mount(
      <ResourcesBar allocated={allocated} expected={expected} total={total} resourceLabel={resourceLabel} />
    );

    expect(wrapper.find(dataQa('resources-bar-insufficient-resources')).text()).toEqual(
      Messages.buildInsufficientLabel(expected, resourceLabel)
    );
  });
});
