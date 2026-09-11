import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';

import DashboardImportPage from './DashboardImportPage';

jest.mock('./import/components/DashboardImportK8s', () => ({
  DashboardImportK8s: jest.fn(() => <div data-testid="import-k8s" />),
}));

const renderPage = () => {
  const props = getRouteComponentProps({
    route: {
      routeName: 'import-dashboard-test',
      path: '/dashboards/import',
      component: () => null,
    },
  });

  return render(<DashboardImportPage {...props} />);
};

describe('DashboardImportPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders k8s import page', () => {
    renderPage();

    expect(screen.getByTestId('import-k8s')).toBeInTheDocument();
  });
});
