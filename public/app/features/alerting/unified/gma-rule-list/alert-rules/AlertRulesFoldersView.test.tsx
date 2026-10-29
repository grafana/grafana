import { HttpResponse, http } from 'msw';
import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { alertRuleFactory, folderFactory, folderItem, recordingRuleFactory } from '../mocks/factories';
import { FOLDER_SEARCH_URL } from '../mocks/handlers';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import { AlertRulesFoldersView } from './AlertRulesFoldersView';

const server = setupMswServer();

const FOLDERS = [
  folderFactory.build({ metadata: { name: 'platform' }, spec: { title: 'Platform' } }),
  folderFactory.inFolder('platform').build({ metadata: { name: 'team' }, spec: { title: 'Team Alerts' } }),
];

const ALERT_RULES = alertRuleFactory.inFolder('team').buildList(2);

function setup(options: Partial<Parameters<typeof setupRuleListBackend>[0]> = {}) {
  return setupRuleListBackend({ folders: FOLDERS, alertRules: ALERT_RULES, ...options });
}

describe('AlertRulesFoldersView', () => {
  it('shows an unavailable message in place of the count when /counts fails, while the folder row stays usable', async () => {
    setup().failNext('folderCounts');

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Count unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('shows zero Alert rules for a folder holding only recording rules', async () => {
    setup({ alertRules: [], recordingRules: [recordingRuleFactory.inFolder('team').build()] });

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('0 alert rules')).toBeInTheDocument();
  });

  it('shows the parents from /parents beside the title, without repeating the folder itself', async () => {
    setup();

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Platform')).toBeInTheDocument();
    expect(screen.getAllByText('Team Alerts')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
  });

  it('keeps the title and count and shows no parent when /parents fails', async () => {
    setup().failNext('folderParents');

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('2 alert rules')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Alerts' })).toBeEnabled();
    expect(screen.queryByText('Platform')).not.toBeInTheDocument();
  });

  it.each([
    { name: 'a folder filter returns no folders', folderUids: ['platform'], text: 'No alert rules match this folder' },
    { name: 'no folder filter is active', folderUids: [], text: 'No alert rules found' },
  ])('says "$text" when $name', async ({ folderUids, text }) => {
    setup({ alertRules: folderUids.length > 0 ? ALERT_RULES : [] });

    render(<AlertRulesFoldersView folderUids={folderUids} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('shows the folder search error with Retry for a 500 response, and the folder after Retry', async () => {
    setup().failNext('folderSearch');

    const { user } = render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load folders');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
  });

  // Malformed responses are not something the fake backend produces, so these answer the folder search directly.
  it('shows the folder search error with Retry for a response that does not match the schema, and the folder after Retry', async () => {
    setup();
    server.use(
      http.post(FOLDER_SEARCH_URL, () => HttpResponse.json({ items: [{ fields: {} }], metadata: {} }), { once: true })
    );

    const { user } = render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load folders');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Team Alerts' })).toBeInTheDocument();
  });

  it('names a folder by its UID when the search returns no title', async () => {
    setup();
    server.use(
      http.post(FOLDER_SEARCH_URL, () =>
        HttpResponse.json({ items: [{ ...folderItem('team', ''), fields: { title: 7 } }], metadata: {} })
      )
    );

    render(<AlertRulesFoldersView folderUids={[]} />);

    expect(await screen.findByRole('link', { name: 'team' })).toBeInTheDocument();
  });
});
