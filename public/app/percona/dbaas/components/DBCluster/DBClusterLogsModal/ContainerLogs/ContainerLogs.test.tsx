import React from 'react';
import { mount } from 'enzyme';
import { ContainerLogs } from './ContainerLogs';

describe('ContainerLogs::', () => {
  it('renders container name and logs', () => {
    const root = mount(
      <ContainerLogs
        containerLogs={{
          name: 'Test',
          isOpen: true,
          logs: 'Test logs',
        }}
      />
    );

    expect(root.text().includes('Test')).toBeTruthy();
    expect(root.find('pre').text()).toEqual('Test logs');
  });

  it("does't render logs when collapsed", () => {
    const root = mount(
      <ContainerLogs
        containerLogs={{
          name: 'Test',
          isOpen: false,
          logs: 'Test logs',
        }}
      />
    );

    expect(root).not.toContain('pre');
  });
});
