import React from 'react';
import { shallow } from 'enzyme';
import { FolderPicker } from './FolderPicker';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: () => ({
    search: jest.fn(() => [
      { title: 'Dash 1', id: 'A' },
      { title: 'Dash 2', id: 'B' },
    ]),
  }),
}));

jest.mock('app/core/services/context_srv', () => ({
  contextSrv: {
    user: { orgId: 1 },
  },
}));

describe('FolderPicker', () => {
  it('should render', () => {
    const wrapper = shallow(<FolderPicker onChange={jest.fn()} />);
    expect(wrapper).toMatchSnapshot();
  });
});
