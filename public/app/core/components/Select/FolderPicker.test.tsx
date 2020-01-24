import React from 'react';
import { shallow } from 'enzyme';

import * as Backend from 'app/core/services/backend_srv';
import { FolderPicker } from './FolderPicker';

jest.spyOn(Backend, 'getBackendSrv').mockReturnValue({
  search: jest.fn(() => [
    { title: 'Dash 1', id: 'A' },
    { title: 'Dash 2', id: 'B' },
  ]),
} as any);

jest.mock('app/core/core', () => ({
  contextSrv: {
    isEditor: true,
  },
}));

describe('FolderPicker', () => {
  it('should render', () => {
    const wrapper = shallow(<FolderPicker onChange={jest.fn()} />);
    expect(wrapper).toMatchSnapshot();
  });
});
