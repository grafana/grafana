import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

import { SettingsService } from 'app/percona/settings/Settings.service';

import { CheckPermissions } from './CheckPermissions';

jest.mock('app/percona/settings/Settings.service');
jest.mock('app/percona/shared/helpers/logger', () => {
  const originalModule = jest.requireActual('app/percona/shared/helpers/logger');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});

describe('CheckPermissions::', () => {
  it('should render children', async () => {
    const { container } = await waitFor(() =>
      render(
        <CheckPermissions>
          <div>Test</div>
        </CheckPermissions>
      )
    );

    expect(container.querySelector('div')).toHaveTextContent('Test');
  });

  it('should render unauthorized message', async () => {
    const errorObj = { response: { status: 401 } };
    jest.spyOn(SettingsService, 'getSettings').mockImplementationOnce(() => {
      throw errorObj;
    });
    await waitFor(() =>
      render(
        <CheckPermissions>
          <div>Test</div>
        </CheckPermissions>
      )
    );

    expect(screen.getByTestId('unauthorized')).not.toBeNull();
  });
});
