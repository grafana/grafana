import React from 'react';
import { mount } from 'enzyme';
import PromLink from './PromLink';

const getPanelData = () => ({
  request: {
    targets: [
      { refId: 'A', datasource: 'prom1' },
      { refId: 'B', datasource: 'prom2' },
    ],
    range: {
      to: {
        utc: () => ({
          format: jest.fn(),
        }),
      },
    },
  },
});
describe('PromLink component', () => {
  it('should show different link when there are 2 components with the same panel data', async () => {
    const Comp = () => (
      <div>
        <PromLink
          datasource={
            { getPrometheusTime: () => 123, createQuery: () => ({ expr: 'up', step: 15 }), directUrl: 'prom1' } as any
          }
          panelData={getPanelData() as any}
          query={{} as any}
        />
        <PromLink
          datasource={
            { getPrometheusTime: () => 123, createQuery: () => ({ expr: 'up', step: 15 }), directUrl: 'prom2' } as any
          }
          panelData={getPanelData() as any}
          query={{} as any}
        />
      </div>
    );
    const wrapper = mount(<Comp />);
    // Trigger componentDidUpdate
    wrapper.setProps('s');
    await Promise.resolve();

    expect(
      wrapper
        .find('a')
        .first()
        .getDOMNode<HTMLAnchorElement>().href
    ).toMatch('prom1');
    expect(
      wrapper
        .find('a')
        .last()
        .getDOMNode<HTMLAnchorElement>().href
    ).toMatch('prom2');
  });
});
