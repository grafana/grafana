import React from 'react';
import { render, screen } from '@testing-library/react';
import { getRouteComponentProps } from 'app/core/navigation/__mocks__/routeProps';
import IntegratedAlertingPage from './IntegratedAlertingPage';

describe('IntegratedAlertingPage', () => {
  it('renders PageWrapper', async () => {
    await render(<IntegratedAlertingPage {...getRouteComponentProps({ match: { params: { tab: '' } } as any })} />);
    expect(screen.queryByText('Alerts')).toBeInTheDocument();
  });
});
