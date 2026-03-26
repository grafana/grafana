import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { getRouteComponentProps } from 'app/core/navigation/mocks/routeProps';

import DashboardImportPage from './DashboardImportPage';

jest.mock('./import/components/DashboardImportK8s', () => ({
  DashboardImportK8s: jest.fn(() => <div data-testid="import-k8s" />),
}));

jest.mock('./import/legacy/DashboardImportLegacy', () => ({
  DashboardImportLegacy: jest.fn(() => <div data-testid="import-legacy" />),
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
    config.featureToggles = {};
    jest.clearAllMocks();
  });

  describe('kubernetesDashboards enabled', () => {
    it('renders k8s import page', () => {
      renderPage();

      expect(screen.getByTestId('import-k8s')).toBeInTheDocument();
      expect(screen.queryByTestId('import-legacy')).not.toBeInTheDocument();
    });
  });
});
