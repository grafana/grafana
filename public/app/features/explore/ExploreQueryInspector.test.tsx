import React from 'react';
import { mount } from 'enzyme';
import { Observable } from 'rxjs';
import { ExploreId } from 'app/types';
import { ExploreDrawer } from 'app/features/explore/ExploreDrawer';
import { TabbedContainer, Button } from '@grafana/ui';
import { TimeRange, LoadingState } from '@grafana/data';
import { ExploreQueryInspector, Props } from './ExploreQueryInspector';

jest.mock('../dashboard/components/Inspector/styles', () => ({
  getPanelInspectorStyles: () => ({}),
}));

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => ({
    getInspectorStream: () =>
      new Observable(subscriber => {
        const response = {
          status: 1,
          statusText: '',
          ok: true,
          headers: {} as any,
          redirected: false,
          type: 'basic',
          url: '',
          request: {} as any,
          data: {
            test: {
              testKey: 'Very unique test value',
            },
          },
          config: {
            url: '',
            hideFromInspector: false,
          },
        };
        subscriber.next(response);
      }) as any,
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
    queryResponse: {
      state: LoadingState.Done,
      series: [],
      timeRange: {} as TimeRange,
    },
  };

  Object.assign(props, propOverrides);

  const wrapper = mount(<ExploreQueryInspector {...props} />);
  return wrapper;
};

describe('ExploreQueryInspector', () => {
  it('should render reseizable ExploreDrawer component', () => {
    const wrapper = setup();
    expect(wrapper.find(ExploreDrawer)).toHaveLength(1);
  });
  it('should render reseizable TabbedContainer component', () => {
    const wrapper = setup();
    expect(wrapper.find(TabbedContainer)).toHaveLength(1);
  });
  it('should have collected query data', () => {
    const wrapper = setup();
    const queryInspctorTab = wrapper.find('[aria-label="Tab Query Inspector"]');
    queryInspctorTab.simulate('click');
    expect(wrapper.html()).toContain('Expand all');
  });
  it('should have collected query data', () => {
    const wrapper = setup();
    const queryInspectorTab = wrapper.find('[aria-label="Tab Query Inspector"]');
    queryInspectorTab.simulate('click');
    const expandButton = wrapper.find(Button).findWhere(n => {
      return n.text() === 'Expand all' && n.type() === Button;
    });
    expandButton.simulate('click');
    expect(wrapper.html()).toContain('Very unique test value');
  });
});
