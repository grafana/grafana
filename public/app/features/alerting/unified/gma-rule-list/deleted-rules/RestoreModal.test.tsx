import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import { API_GROUP, API_VERSION } from '@grafana/api-clients/rtkq/rules.alerting/v0alpha1';

import { setupMswServer } from '../../mockApi';
import { makeDeletedRule } from '../mocks/handlers';

import { RestoreModal } from './RestoreModal';

const server = setupMswServer();
const CREATE_URL = `/apis/${API_GROUP}/${API_VERSION}/namespaces/default/alertrules`;

describe('RestoreModal', () => {
  it('shows the rule title in the confirmation', () => {
    render(<RestoreModal rule={makeDeletedRule()} onDismiss={jest.fn()} onSuccess={jest.fn()} />);
    expect(screen.getByText(/Deleted rule/i)).toBeInTheDocument();
  });

  it('calls onDismiss when cancelled', async () => {
    const onDismiss = jest.fn();
    render(<RestoreModal rule={makeDeletedRule()} onDismiss={onDismiss} onSuccess={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onSuccess after a successful restore', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({}, { status: 200 })));
    const onSuccess = jest.fn();
    render(<RestoreModal rule={makeDeletedRule()} onDismiss={jest.fn()} onSuccess={onSuccess} />);
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect((await screen.findAllByText(/restored/i)).length).toBeGreaterThan(0);
  });

  it('shows conflict message on 409', async () => {
    server.use(http.post(CREATE_URL, () => HttpResponse.json({ message: 'conflict' }, { status: 409 })));
    render(<RestoreModal rule={makeDeletedRule()} onDismiss={jest.fn()} onSuccess={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Restore/i }));
    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });
});
