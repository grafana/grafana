import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { render, screen, waitFor } from 'test/test-utils';

import { type NavModel } from '@grafana/data';
import { setBackendSrv } from '@grafana/runtime';
import { setupMockServer } from '@grafana/test-utils/server';
import { ModalRoot } from '@grafana/ui';
import { type Organization } from 'app/types/organization';

import { backendSrv } from '../../core/services/backend_srv';

import { OrgDetailsPage, type Props } from './OrgDetailsPage';
import { setOrganizationName } from './state/reducers';

jest.mock('app/core/services/context_srv', () => {
  return {
    contextSrv: {
      ...jest.requireActual('app/core/services/context_srv').contextSrv,
      hasPermission: () => true,
    },
  };
});

setBackendSrv(backendSrv);
// needed because SharedPreferences is rendered in the test
setupMockServer();

const setup = (propOverrides?: object) => {
  const props: Props = {
    organization: {} as Organization,
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Org details',
      },
    } as NavModel,
    loadOrganization: jest.fn(),
    setOrganizationName: mockToolkitActionCreator(setOrganizationName),
    updateOrganization: jest.fn(),
  };
  Object.assign(props, propOverrides);

  return render(
    <>
      <OrgDetailsPage {...props} />
      <ModalRoot />
    </>
  );
};

describe('Render', () => {
  it('should render component', () => {
    expect(() => setup()).not.toThrow();
  });

  it('should render organization and preferences', async () => {
    setup({
      organization: {
        name: 'Cool org',
        id: 1,
      },
    });

    expect(screen.getByRole('textbox', { name: 'Organization name' })).toHaveValue('Cool org');
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Interface theme' })).toHaveValue('Light'));
  });

  it('should show a modal when submitting', async () => {
    const { user } = setup({
      organization: {
        name: 'Cool org',
        id: 1,
      },
    });

    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Interface theme' })).toHaveValue('Light'));
    await user.click(screen.getByRole('button', { name: 'Save preferences' }));

    expect(await screen.findByText('Confirm preferences update')).toBeInTheDocument();
  });
});
