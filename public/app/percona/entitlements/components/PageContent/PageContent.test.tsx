import { render, screen } from '@testing-library/react';
import { PageContent } from './PageContent';
import React from 'react';

describe('PageContent', () => {
  it('should display the noData section when no data is passed', async () => {
    await render(<PageContent hasData={false} emptyMessage="empty" />);
    expect(screen.getByTestId('page-no-data')).toBeInTheDocument();
    expect(screen.getByText('empty')).toBeInTheDocument();
  });

  it('should not display the noData section when no data is passed and it is still loading', async () => {
    render(<PageContent loading={true} hasData={false} emptyMessage="empty" />);
    expect(screen.getByTestId('page-no-data')).toBeInTheDocument();
    expect(screen.queryByText('empty')).not.toBeInTheDocument();
  });

  it('should display the page when there is data', async () => {
    const Dummy = () => <span data-testid="dummy"></span>;
    render(
      <PageContent hasData={true} emptyMessage="no data">
        <Dummy />
      </PageContent>
    );

    expect(screen.queryByTestId('page-no-data')).not.toBeInTheDocument();
    expect(screen.getByTestId('dummy')).toBeInTheDocument();
  });
});
