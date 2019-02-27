import React from 'react';
import { shallow } from 'enzyme';
import { OrgDetailsPage, Props } from './OrgDetailsPage';
import { NavModel, Organization } from '../../types';

const setup = (propOverrides?: object) => {
  const props: Props = {
    organization: {} as Organization,
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Org details',
      },
    } as NavModel,
    loadOrganization: jest.fn(),
    setOrganizationName: jest.fn(),
    updateOrganization: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<OrgDetailsPage {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render organization and preferences', () => {
    const wrapper = setup({
      organization: {
        name: 'Cool org',
        id: 1,
      },
      preferences: {
        homeDashboardId: 1,
        theme: 'Default',
        timezone: 'Default',
      },
    });

    expect(wrapper).toMatchSnapshot();
  });
});
