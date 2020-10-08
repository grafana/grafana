import React from 'react';
import { shallow } from 'enzyme';
import { ExploreId } from 'app/types';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { TabbedContainer } from '@grafana/ui';
import { ExploreQueryInspector, Props } from './ExploreQueryInspector';

jest.mock('../dashboard/components/Inspector/styles', () => ({
  getPanelInspectorStyles: () => ({}),
}));

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    getInspectorStream: jest.fn().mockResolvedValue({
      status: 1,
      statusText: 'a',
      ok: true,
      headers: {} as any,
      redirected: false,
      type: 'basic',
      url: 'www',
      config: {
        url: 'www',
      },
    }),
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    loading: false,
    width: 100,
    exploreId: ExploreId.left,
    onClose: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<ExploreQueryInspector {...props} />);
  return wrapper;
};

describe('ExploreQueryInspector', () => {
  it('should render reseizable ExploreDrawer component', () => {
    const wrapper = setup();
    expect(wrapper.find(ExploreDrawer)).toHaveLength(1);
  });
  it('should have 2 tabs', () => {
    const wrapper = setup();
    const tabbedContainer = wrapper.find(TabbedContainer) as any;
    expect(tabbedContainer.props().tabs.length).toBe(2);
  });
});
