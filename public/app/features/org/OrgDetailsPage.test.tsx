import 'whatwg-fetch'; // fetch polyfill needed @grafana/runtime
import { render } from '@testing-library/react';
import React from 'react';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';

import { NavModel } from '@grafana/data';

import { Organization } from '../../types';

import { OrgDetailsPage, Props } from './OrgDetailsPage';
import { setOrganizationName } from './state/reducers';

jest.mock('app/core/core', () => {
  return {
    contextSrv: {
      hasPermission: () => true,
    },
  };
});

jest.mock('@grafana/runtime', () => {
  const originalModule = jest.requireActual('@grafana/runtime');
  return {
    ...originalModule,
    config: {
      ...originalModule.config,
      featureToggles: {
        internationalization: true,
      },
    },
  };
});

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
    setOrganizationName: mockToolkitActionCreator(setOrganizationName),
    updateOrganization: jest.fn(),
  };

  Object.assign(props, propOverrides);

  render(<OrgDetailsPage {...props} />);
};

describe('Render', () => {
  it('should render component', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should render organization and preferences', () => {
    expect(() =>
      setup({
        organization: {
          name: 'Cool org',
          id: 1,
        },
        preferences: {
          homeDashboardId: 1,
          theme: 'Default',
          timezone: 'Default',
          locale: '',
        },
      })
    ).not.toThrow();
  });
});
