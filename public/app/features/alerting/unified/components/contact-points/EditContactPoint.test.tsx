import 'core-js/stable/structured-clone';
import { Route, Routes } from 'react-router-dom-v5-compat';
import { clickSelectOption } from 'test/helpers/selectOptionInTest';
import { render, screen } from 'test/test-utils';

import EditContactPoint from 'app/features/alerting/unified/components/contact-points/EditContactPoint';
import { AccessControlAction } from 'app/types';

import { setupMswServer } from '../../mockApi';
import { grantUserPermissions } from '../../mocks';

setupMswServer();

const Index = () => {
  return <div>redirected</div>;
};

const renderEditContactPoint = (contactPointUid: string) =>
  render(
    <Routes>
      <Route path="/alerting/notifications" element={<Index />} />
      <Route path="/alerting/notifications/receivers/:name/edit" element={<EditContactPoint />} />
    </Routes>,
    {
      historyOptions: { initialEntries: [`/alerting/notifications/receivers/${contactPointUid}/edit`] },
    }
  );

beforeEach(() => {
  grantUserPermissions([AccessControlAction.AlertingNotificationsRead, AccessControlAction.AlertingNotificationsWrite]);
});

const getTemplatePreviewContent = async () =>
  await screen.findByRole('presentation', { description: /Preview with the default payload/i });

const templatesSelectorTestId = 'existing-templates-selector';

describe('Edit contact point', () => {
  jest.retryTimes(2);
  it('can edit a contact point with existing template field values', async () => {
    const { user } = renderEditContactPoint('lotsa-emails');

    // Expand settings and open "edit message template" drawer
    await user.click(await screen.findByText(/optional email settings/i));
    await user.click(await screen.findByRole('button', { name: /edit message/i }));
    expect(await screen.findByRole('dialog', { name: /edit message/i })).toBeInTheDocument();
    expect(await getTemplatePreviewContent()).toHaveTextContent(/some example preview for slack-template/i);

    // Change the preset template and check that the preview updates correctly
    await clickSelectOption(screen.getByTestId(templatesSelectorTestId), 'custom-email');
    expect(await getTemplatePreviewContent()).toHaveTextContent(/some example preview for custom-email/i);

    // Close the drawer
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    // Check a setting that has an existing custom value, and change it to a preset template
    await user.click(await screen.findByRole('button', { name: /edit subject/i }));
    expect(await screen.findByRole('dialog', { name: /edit subject/i })).toBeInTheDocument();
    // If this isn't correct, then we haven't set the correct initial state for the radio buttons/tabs
    expect(await screen.findByLabelText(/custom template value/i)).toHaveValue('some custom value');

    await user.click(screen.getByRole('radio', { name: /select notification template/i }));
    await clickSelectOption(screen.getByTestId(templatesSelectorTestId), 'slack-template');

    expect(await getTemplatePreviewContent()).toHaveTextContent(/some example preview for slack-template/i);

    // Close the drawer
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(await screen.findByText(/template: custom-email/i)).toBeInTheDocument();
    expect(await screen.findByText(/template: slack-template/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /save contact point/i }));

    expect(await screen.findByText(/redirected/i)).toBeInTheDocument();
  }, 600000);
});
