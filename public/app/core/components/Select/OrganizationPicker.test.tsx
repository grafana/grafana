import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { OrganizationPicker } from './OrganizationPicker';

jest.mock('app/core/services/backend_srv', () => ({
  getBackendSrv: () => {
    return {
      get: () => {
        return Promise.resolve([]);
      },
    };
  },
}));

describe('OrganizationPicker', () => {
  it('renders correctly', () => {
    const props = {
      onSelected: () => {},
    };
    const tree = renderer.create(<OrganizationPicker {...props} />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
