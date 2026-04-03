import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from 'test/test-utils';

import { ROUTES_META_SYMBOL, type Route } from '../../../../../../plugins/datasource/alertmanager/types';
import { useAlertmanagerAbilities } from '../../../hooks/useAbilities';
import { K8sAnnotations } from '../../../utils/k8s/constants';

import { ActionButtons } from './ActionButtons';

jest.mock('../../../hooks/useAbilities', () => ({
  ...jest.requireActual('../../../hooks/useAbilities'),
  useAlertmanagerAbilities: jest.fn(),
}));

jest.mock('../useExportRoutingTree', () => ({
  useExportRoutingTree: () => [null, jest.fn()],
}));

jest.mock('../useNotificationPolicyRoute', () => ({
  ...jest.requireActual('../useNotificationPolicyRoute'),
  useDeleteRoutingTree: () => [{ execute: jest.fn() }],
}));

const useAlertmanagerAbilitiesMock = jest.mocked(useAlertmanagerAbilities);

function grantAllAbilities() {
  useAlertmanagerAbilitiesMock.mockReturnValue([
    [true, true],
    [true, true],
    [true, true],
  ]);
}

function makeRoute(annotations?: Record<string, string>): Route {
  const route: Route = {
    name: 'test-route',
    receiver: 'grafana-default-email',
  };

  if (annotations) {
    route[ROUTES_META_SYMBOL] = {
      name: 'test-route',
      metadata: { annotations },
    };
  }

  return route;
}

describe('ActionButtons', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    grantAllAbilities();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should show manage permissions button when route has canAdmin annotation', () => {
    const route = makeRoute({
      [K8sAnnotations.AccessAdmin]: 'true',
    });

    render(<ActionButtons route={route} />);

    expect(screen.getByTestId('manage-permissions-action')).toBeInTheDocument();
  });

  it('should not show manage permissions button when route lacks canAdmin annotation', () => {
    const route = makeRoute();

    render(<ActionButtons route={route} />);

    expect(screen.queryByTestId('manage-permissions-action')).not.toBeInTheDocument();
  });

  it('should not show manage permissions button when canAdmin is false', () => {
    const route = makeRoute({
      [K8sAnnotations.AccessAdmin]: 'false',
    });

    render(<ActionButtons route={route} />);

    expect(screen.queryByTestId('manage-permissions-action')).not.toBeInTheDocument();
  });

  it('should open permissions drawer when manage permissions button is clicked', async () => {
    jest.spyOn(console, 'error').mockImplementation();

    const user = userEvent.setup();

    const route = makeRoute({
      [K8sAnnotations.AccessAdmin]: 'true',
    });

    render(<ActionButtons route={route} />);

    await user.click(screen.getByTestId('manage-permissions-action'));

    expect(screen.getByRole('dialog', { name: /manage permissions/i })).toBeInTheDocument();
  });

  describe('entity-level write permission (canWrite annotation)', () => {
    it('should show Edit button when canWrite annotation is true, overriding global RBAC', () => {
      const route = makeRoute({
        [K8sAnnotations.AccessWrite]: 'true',
      });

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('edit-action')).toBeInTheDocument();
      expect(screen.queryByTestId('view-action')).not.toBeInTheDocument();
    });

    it('should show View button when canWrite annotation is false, even with global RBAC allowed', () => {
      const route = makeRoute({
        [K8sAnnotations.AccessWrite]: 'false',
      });

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('view-action')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-action')).not.toBeInTheDocument();
    });

    it('should show View button when global RBAC disallows update and there is no K8s metadata', () => {
      useAlertmanagerAbilitiesMock.mockReturnValue([
        [true, false],
        [true, true],
        [true, true],
      ]);

      const route = makeRoute();

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('view-action')).toBeInTheDocument();
      expect(screen.queryByTestId('edit-action')).not.toBeInTheDocument();
    });

    it('should show Edit button when there is no K8s metadata and global RBAC allows update', () => {
      const route = makeRoute();

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('edit-action')).toBeInTheDocument();
    });
  });

  describe('entity-level delete permission (canDelete annotation)', () => {
    it('should disable the delete button when canDelete annotation is false, even with global RBAC allowed', () => {
      const route = makeRoute({
        [K8sAnnotations.AccessDelete]: 'false',
      });

      render(<ActionButtons route={route} />);

      // LinkButton renders as <a> so disabled state is expressed via aria-disabled
      expect(screen.getByTestId('delete-action')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not disable the delete button when canDelete annotation is true', () => {
      const route = makeRoute({
        [K8sAnnotations.AccessDelete]: 'true',
      });

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('delete-action')).not.toHaveAttribute('aria-disabled', 'true');
    });

    it('should disable the delete button when global RBAC disallows and there is no K8s metadata', () => {
      useAlertmanagerAbilitiesMock.mockReturnValue([
        [true, true],
        [true, false],
        [true, true],
      ]);

      const route = makeRoute();

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('delete-action')).toHaveAttribute('aria-disabled', 'true');
    });

    it('should not disable the delete button when global RBAC allows and there is no K8s metadata', () => {
      const route = makeRoute();

      render(<ActionButtons route={route} />);

      expect(screen.getByTestId('delete-action')).not.toHaveAttribute('aria-disabled', 'true');
    });
  });
});
