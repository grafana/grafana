import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';

import { contextSrv } from '../../../../core/services/context_srv';

import { ConnectionsRedirectNotice } from './ConnectionsRedirectNotice';

const setup = (hasAccessToDS: boolean) => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(hasAccessToDS);

  render(
    <MemoryRouter>
      <ConnectionsRedirectNotice />
    </MemoryRouter>
  );
};

describe('ConnectionsRedirectNotice', () => {
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
  });

  it('should render component when has access to data sources', () => {
    setup(true);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('should not render component when has no access to data sources', () => {
    setup(false);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
