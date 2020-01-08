import React from 'react';
// @ts-ignore
import renderer from 'react-test-renderer';
import { TeamPicker } from './TeamPicker';

jest.mock('@grafana/runtime', () => ({
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
