import { render, screen } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { Provider } from 'react-redux';

import { configureStore } from 'app/store/configureStore';
import { StoreState } from 'app/types';

import AccessRolesEnabledCheck from './AccessRolesEnabledCheck';

const wrapWithProvider = (element: ReactElement, enableAccessControl = true) => (
  <Provider
    store={configureStore({
      percona: {
        settings: {
          result: {
            enableAccessControl,
          },
        },
      },
    } as StoreState)}
  >
    {element}
  </Provider>
);

describe('AccessRoleEnabledCheck:', () => {
  it('shows component when access roles are enabled', () => {
    render(
      wrapWithProvider(
        <AccessRolesEnabledCheck>
          <button />
        </AccessRolesEnabledCheck>
      )
    );
    expect(screen.queryByRole('button')).toBeInTheDocument();
  });

  it("doesn't show element when access roles are disabled", () => {
    render(
      wrapWithProvider(
        <AccessRolesEnabledCheck>
          <button />
        </AccessRolesEnabledCheck>,
        false
      )
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
