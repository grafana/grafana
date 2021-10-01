import React from 'react';
import { mount } from 'enzyme';
import { dataTestId } from '@percona/platform-core';
import { PodLogs } from './PodLogs';

describe('PodLogs::', () => {
  it('renders pod name, events and containers', () => {
    const root = mount(
      <PodLogs
        podLogs={{
          name: 'Pod name',
          isOpen: true,
          events: 'Test events',
          containers: [
            {
              name: 'Test container 1',
              isOpen: true,
              logs: 'Test logs',
            },
            {
              name: 'Test container 2',
              isOpen: false,
              logs: 'Test logs',
            },
          ],
        }}
      />
    );

    expect(root.text().includes('Pod name')).toBeTruthy();
    expect(root.find(dataTestId('dbcluster-pod-events')).text()).toEqual('Test events');
    expect(root.find(dataTestId('dbcluster-containers')).children().length).toBe(2);
  });

  it("doesn't render logs when collapsed", () => {
    const root = mount(
      <PodLogs
        podLogs={{
          name: 'Pod name',
          isOpen: false,
          events: 'Test events',
          containers: [
            {
              name: 'Test container 1',
              isOpen: true,
              logs: 'Test logs',
            },
          ],
        }}
      />
    );

    expect(root).not.toContain(dataTestId('dbcluster-pod-events'));
    expect(root).not.toContain(dataTestId('dbcluster-containers'));
  });
});
