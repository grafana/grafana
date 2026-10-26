import { render, screen } from 'test/test-utils';

import { setupMswServer } from '../../mockApi';
import { mockFolderCounts } from '../mocks/handlers';

import { FolderRuleCount } from './FolderRuleCount';

setupMswServer();

describe('FolderRuleCount', () => {
  it('names the count with its explanation, so it is not only a hover tooltip', async () => {
    mockFolderCounts('alert', { root: 3 });

    render(<FolderRuleCount folderUid="root" kind="alert" />);

    expect(
      await screen.findByRole('img', {
        name: '3 alert rules. Rules directly in this folder. Subfolders are listed separately.',
      })
    ).toHaveTextContent('3 alert rules');
  });

  it('explains on hover that the count covers only rules directly in the folder', async () => {
    mockFolderCounts('alert', { root: 2 });

    const { user } = render(<FolderRuleCount folderUid="root" kind="alert" />);
    await user.hover(await screen.findByText('2 alert rules'));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Rules directly in this folder. Subfolders are listed separately.'
    );
  });

  it('counts the rule kind it is given', async () => {
    mockFolderCounts('recording', { root: 1 });

    render(<FolderRuleCount folderUid="root" kind="recording" />);

    expect(await screen.findByText('1 recording rule')).toBeInTheDocument();
  });
});
