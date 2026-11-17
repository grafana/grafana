import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { alertRuleFactory, folderFactory, recordingRuleFactory } from '../mocks/factories';
import { setupRuleListBackend } from '../mocks/ruleListBackend';

import { FolderRuleCount } from './FolderRuleCount';

setupMswServer();

const ROOT = folderFactory.build({ metadata: { name: 'root' } });

describe('FolderRuleCount', () => {
  it('names the count with its explanation, so it is not only a hover tooltip', async () => {
    setupRuleListBackend({ folders: [ROOT], alertRules: alertRuleFactory.inFolder('root').buildList(3) });

    render(<FolderRuleCount folderUid="root" kind="alert" />);

    expect(
      await screen.findByRole('img', {
        name: '3 alert rules. Rules directly in this folder. Subfolders are listed separately.',
      })
    ).toHaveTextContent('3 alert rules');
  });

  it('explains on hover that the count covers only rules directly in the folder', async () => {
    setupRuleListBackend({ folders: [ROOT], alertRules: alertRuleFactory.inFolder('root').buildList(2) });

    const { user } = render(<FolderRuleCount folderUid="root" kind="alert" />);
    await user.hover(await screen.findByText('2 alert rules'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Rules directly in this folder. Subfolders are listed separately.'
    );
  });

  it('counts the rule kind it is given', async () => {
    setupRuleListBackend({ folders: [ROOT], recordingRules: recordingRuleFactory.inFolder('root').buildList(1) });

    render(<FolderRuleCount folderUid="root" kind="recording" />);

    expect(await screen.findByText('1 recording rule')).toBeInTheDocument();
  });
});
