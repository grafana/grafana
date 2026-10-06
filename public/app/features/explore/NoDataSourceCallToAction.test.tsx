import { render, screen } from '@testing-library/react';

import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { NoDataSourceCallToAction } from './NoDataSourceCallToAction';

jest.mock('app/core/services/context_srv');

describe('NoDataSourceCallToAction', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders call to action card with add data source button enabled when user has permission', () => {
    jest.mocked(contextSrv.hasPermission).mockReturnValue(true);

    render(<NoDataSourceCallToAction />);
    const linkButton = screen.getByRole('link', { name: /add data source/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).not.toHaveAttribute('aria-disabled', 'true');
  });

  it('renders button disabled when user lacks permission', () => {
    jest.mocked(contextSrv.hasPermission).mockImplementation((action) => {
      if (action === AccessControlAction.DataSourcesCreate) {
        return false;
      }
      return true;
    });

    render(<NoDataSourceCallToAction />);
    const linkButton = screen.getByRole('link', { name: /add data source/i });
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).toHaveAttribute('aria-disabled', 'true');
  });
});
