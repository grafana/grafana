import React from 'react';
import { shallow } from 'enzyme';
import ServiceaccountsTable, { Props } from './ServiceaccountsTable';
import { OrgServiceaccount } from 'app/types';
import { getMockserviceaccounts } from './__mocks__/serviceaccountsMocks';
import { ConfirmModal } from '@grafana/ui';

jest.mock('app/core/core', () => ({
  contextSrv: {
    hasPermission: () => true,
    accessControlEnabled: () => false,
  },
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    serviceaccounts: [] as OrgServiceaccount[],
    onRoleChange: jest.fn(),
    onRemoveServiceaccount: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return shallow(<ServiceaccountsTable {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render serviceaccounts table', () => {
    const wrapper = setup({
      serviceaccounts: getMockserviceaccounts(5),
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Remove modal', () => {
  it('should render correct amount', () => {
    const wrapper = setup({
      serviceaccounts: getMockserviceaccounts(3),
    });
    expect(wrapper.find(ConfirmModal).length).toEqual(4);
  });
});
