import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { AppNotificationList } from 'app/core/components/AppNotifications/AppNotificationList';

import { AttachToIncidentButton } from './AttachToIncidentButton';
import { STUB_ATTACH_TESTID, notebookIncidents, stubAttachForm } from './testHelpers';
import { useNotebookIncidents } from './useNotebookIncidents';

jest.mock('./useNotebookIncidents', () => ({
  ...jest.requireActual('./useNotebookIncidents'),
  useNotebookIncidents: jest.fn(),
}));

const mockUseNotebookIncidents = jest.mocked(useNotebookIncidents);

function setup({ installed = true } = {}) {
  const { Stub, props } = stubAttachForm();
  mockUseNotebookIncidents.mockReturnValue(notebookIncidents(installed ? { AttachToIncidentForm: Stub } : {}));

  const rendered = render(
    <>
      <AppNotificationList />
      <AttachToIncidentButton uid="nb1" title="PromQL query (4)" />
    </>
  );

  return { ...rendered, props };
}

describe('AttachToIncidentButton', () => {
  const originalAppUrl = config.appUrl;

  beforeEach(() => {
    config.appUrl = 'https://grafana.example/';
  });

  afterEach(() => {
    config.appUrl = originalAppUrl;
  });

  it('renders nothing at all when IRM is not installed', () => {
    setup({ installed: false });

    expect(screen.queryByRole('button', { name: /Attach to incident/ })).not.toBeInTheDocument();
  });

  it('opens IRM’s form in a modal', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Attach to incident/ }));

    expect(await screen.findByRole('dialog', { name: 'Attach to incident' })).toBeInTheDocument();
    expect(screen.getByTestId(STUB_ATTACH_TESTID)).toBeInTheDocument();
  });

  // The URL is what IRM attaches, and the caption is what labels it — without one it falls back to
  // unfurling the URL, which reads "Grafana" because core serves one page title for every route.
  it('hands the form the notebook’s absolute url and a caption naming it', async () => {
    const { user, props } = setup();

    await user.click(screen.getByRole('button', { name: /Attach to incident/ }));

    expect(props.at(-1)).toMatchObject({
      attachURL: 'https://grafana.example/notebooks/nb1',
      defaultCaption: 'Notebook: PromQL query (4)',
    });
  });

  // IRM raises its own success toast, which carries no link. This is the one that can be followed.
  it('raises a toast linking to the incident once attached', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Attach to incident/ }));
    await user.click(screen.getByTestId(STUB_ATTACH_TESTID));

    expect(await screen.findByText(/Notebook attached to "Checkout 5xx spike"/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View incident' })).toHaveAttribute(
      'href',
      '/a/grafana-irm-app/incidents/101'
    );
  });
});
