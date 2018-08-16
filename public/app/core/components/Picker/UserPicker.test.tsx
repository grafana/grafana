import React from 'react';
import renderer from 'react-test-renderer';
import { UserPicker } from './UserPicker';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([]);
      },
    };
  },
}));

describe('UserPicker', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<UserPicker onSelected={() => {}} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
