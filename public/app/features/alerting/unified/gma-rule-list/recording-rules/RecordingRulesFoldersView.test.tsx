import { render, screen, within } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import { RecordingRulesFoldersView } from './RecordingRulesFoldersView';

setupMswServer();

const FOLDERS = [
  folderFactory.build({ metadata: { name: 'platform' }, spec: { title: 'Platform' } }),
  folderFactory.inFolder('platform').build({ metadata: { name: 'team' }, spec: { title: 'Team Metrics' } }),
];

const RECORDING_RULES = recordingRuleFactory.inFolder('team').buildList(2);

function setup(options: Partial<Parameters<typeof setupRuleListBackend>[0]> = {}) {
  return setupRuleListBackend({ folders: FOLDERS, recordingRules: RECORDING_RULES, ...options });
}

async function findFolderRow(title: string) {
  const row = (await screen.findByRole('link', { name: title })).closest('li');
  if (!row) {
    throw new Error(`No row for folder ${title}`);
  }
  return row;
}

describe('RecordingRulesFoldersView', () => {
  it('shows a folder holding rules with its parent and its own count, and its rules once expanded', async () => {
    setup();
    const { user } = render(<RecordingRulesFoldersView folderUids={[]} />);

    const row = await findFolderRow('Team Metrics');
    expect(await within(row).findByText('Platform')).toBeInTheDocument();
    expect(await within(row).findByRole('img', { name: /^2 recording rules\./ })).toBeInTheDocument();
    // Platform holds no rules itself, so it appears only as the parent.
    expect(screen.queryByRole('link', { name: 'Platform' })).not.toBeInTheDocument();

    await user.click(within(row).getByRole('button', { name: 'Expand Team Metrics' }));

    for (const rule of RECORDING_RULES) {
      expect(await within(row).findByRole('link', { name: rule.spec.title })).toBeInTheDocument();
    }
  });

  it('shows an unavailable message in place of the count when /counts fails, while the folder row stays usable', async () => {
    setup().failNext('folderCounts');

    render(<RecordingRulesFoldersView folderUids={[]} />);

    expect(await screen.findByText('Count unavailable')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Expand Team Metrics' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('shows zero Recording rules for a folder holding only alert rules', async () => {
    setup({ recordingRules: [], alertRules: [alertRuleFactory.inFolder('team').build()] });

    render(<RecordingRulesFoldersView folderUids={[]} />);

    const row = await findFolderRow('Team Metrics');
    expect(await within(row).findByRole('img', { name: /^0 recording rules\./ })).toBeInTheDocument();
  });

  it.each([
    {
      name: 'a folder filter returns no folders',
      folderUids: ['platform'],
      text: 'No recording rules match this folder',
    },
    { name: 'no folder filter is active', folderUids: [], text: 'No recording rules found' },
  ])('says "$text" when $name', async ({ folderUids, text }) => {
    setup({ recordingRules: folderUids.length > 0 ? RECORDING_RULES : [] });

    render(<RecordingRulesFoldersView folderUids={folderUids} />);

    expect(await screen.findByText(text)).toBeInTheDocument();
  });

  it('shows the folder search error with Retry for a 500 response, and the folder after Retry', async () => {
    setup().failNext('folderSearch');

    const { user } = render(<RecordingRulesFoldersView folderUids={[]} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Failed to load folders');

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByRole('link', { name: 'Team Metrics' })).toBeInTheDocument();
  });
});
