import { render, screen } from '@testing-library/react';
import React from 'react';

import { TableContent } from './TableContent';

describe('TableContent', () => {
  it('should display the noData section when no data is passed', async () => {
    render(<TableContent hasData={false} emptyMessage="empty" />);
    const noData = screen.getByTestId('table-no-data');

    expect(noData).toBeInTheDocument();
    expect(noData).toHaveTextContent('empty');
  });

  it('should not display the noData section when no data is passed and it is still loading', async () => {
    render(<TableContent loading={true} hasData={false} emptyMessage="empty" />);
    const noData = screen.getByTestId('table-no-data');

    expect(noData).toBeInTheDocument();
    expect(noData.textContent).toHaveLength(0);
  });

  it('should display the table when there is data', async () => {
    const Dummy = () => <span data-testid="dummy" />;
    render(
      <TableContent hasData={true} emptyMessage="no data">
        <Dummy />
      </TableContent>
    );

    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
    expect(screen.getByTestId('dummy')).toBeInTheDocument();
  });
});
