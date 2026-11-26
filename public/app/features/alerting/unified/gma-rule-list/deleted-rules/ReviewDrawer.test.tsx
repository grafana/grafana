import { HttpResponse, http } from 'msw';
import { render, screen, userEvent } from 'test/test-utils';

import server from '@grafana/test-utils/server';

import { setupMswServer } from '../../mockApi';
import { FOLDER_PARENTS_URL, makeDeletedRule } from '../mocks/handlers';

import { ReviewDrawer } from './ReviewDrawer';

setupMswServer();

describe('ReviewDrawer', () => {
  beforeEach(() => {
    server.use(
      http.get(FOLDER_PARENTS_URL, () =>
        HttpResponse.json({
          items: [
            { name: 'folder-uid', title: 'Platform' },
            { name: 'sub', title: 'Infra' },
          ],
        })
      )
    );
  });

  it('shows the rule title', () => {
    render(<ReviewDrawer rule={makeDeletedRule()} onClose={jest.fn()} />);
    expect(screen.getByText('Deleted rule')).toBeInTheDocument();
  });

  it('shows the resolved folder path', async () => {
    render(<ReviewDrawer rule={makeDeletedRule()} onClose={jest.fn()} />);
    // FolderPath renders segments as separate spans
    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getByText('Infra')).toBeInTheDocument();
  });

  it('calls onClose when closed', async () => {
    const onClose = jest.fn();
    render(<ReviewDrawer rule={makeDeletedRule()} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('reveals K8s JSON when Advanced section is expanded', async () => {
    render(<ReviewDrawer rule={makeDeletedRule()} onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Advanced/i }));
    expect(screen.getByRole('code')).toBeInTheDocument();
  });

  it('JSON shows only the rule spec, not metadata', async () => {
    render(<ReviewDrawer rule={makeDeletedRule()} onClose={jest.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Advanced/i }));
    const json = screen.getByRole('code').textContent ?? '';
    // spec fields appear
    expect(json).toContain('title');
    // metadata fields do not appear
    expect(json).not.toContain('deletionTimestamp');
    expect(json).not.toContain('grafana.app/folder');
  });
});
