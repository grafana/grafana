import { render, screen } from '@testing-library/react';

import { contextSrv } from '../../../../core/services/context_srv';

import { ConnectionsRedirectNotice } from './ConnectionsRedirectNotice';

const setup = (hasAccessToDS: boolean) => {
  jest.spyOn(contextSrv, 'hasPermission').mockReturnValue(hasAccessToDS);

  render(<ConnectionsRedirectNotice />);
};

describe('ConnectionsRedirectNotice', () => {
  it('should render component when has access to data sources', () => {
    setup(true);
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('should not render component when has no access to data sources', () => {
    setup(false);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
