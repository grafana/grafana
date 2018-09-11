import React from 'react';
import renderer from 'react-test-renderer';
import { TeamPicker } from './TeamPicker';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([]);
      },
    };
  },
}));

describe('TeamPicker', () => {
  it('renders correctly', () => {
    const props = {
      onSelected: () => {},
    };
    const tree = renderer.create(<TeamPicker {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
