import React from 'react';
import { mount } from 'enzyme';
import { dataQa } from '@percona/platform-core';
import { DBClusterStatus as Status } from '../DBCluster.types';
import { DBClusterStatus } from './DBClusterStatus';

describe('DBClusterStatus::', () => {
  it('renders correctly when active', () => {
    const root = mount(
      <DBClusterStatus status={Status.ready} message="Should not render error" finishedSteps={10} totalSteps={10} />
    );
    const span = root.find('span');

    expect(root.find(dataQa('cluster-status-active'))).toBeTruthy();
    expect(root.find(dataQa('cluster-status-error-message')).length).toBe(0);
    expect(span.prop('className')).toContain('active');
  });

  it('renders progress bar when changing', () => {
    const root = mount(
      <DBClusterStatus status={Status.changing} message="Should not render error" finishedSteps={5} totalSteps={10} />
    );

    expect(root.find(dataQa('cluster-status-active')).length).toBe(0);
    expect(root.find(dataQa('cluster-progress-bar')).length).toBe(1);
    expect(root.find(dataQa('cluster-status-error-message')).length).toBe(0);
  });

  it('renders error and progress bar when failed', () => {
    const root = mount(
      <DBClusterStatus status={Status.failed} message="Should render error" finishedSteps={5} totalSteps={10} />
    );

    expect(root.find(dataQa('cluster-status-active')).length).toBe(0);
    expect(root.find(dataQa('cluster-progress-bar')).length).toBe(1);
    expect(root.find(dataQa('cluster-status-error-message')).length).toBe(1);
  });
});
