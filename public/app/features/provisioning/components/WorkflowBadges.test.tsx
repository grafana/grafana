import { render, screen } from 'test/test-utils';

import { WorkflowBadges } from './WorkflowBadges';

describe('WorkflowBadges', () => {
  it.each([
    { workflows: [] as Array<'write' | 'branch'>, shown: ['Read only'], hidden: ['Direct push', 'Pull request'] },
    {
      workflows: ['write'] as Array<'write' | 'branch'>,
      shown: ['Direct push'],
      hidden: ['Read only', 'Pull request'],
    },
    {
      workflows: ['branch'] as Array<'write' | 'branch'>,
      shown: ['Pull request'],
      hidden: ['Read only', 'Direct push'],
    },
    {
      workflows: ['write', 'branch'] as Array<'write' | 'branch'>,
      shown: ['Direct push', 'Pull request'],
      hidden: ['Read only'],
    },
  ])('shows $shown for workflows $workflows', ({ workflows, shown, hidden }) => {
    render(<WorkflowBadges workflows={workflows} />);

    shown.forEach((text) => expect(screen.getByText(text)).toBeInTheDocument());
    hidden.forEach((text) => expect(screen.queryByText(text)).not.toBeInTheDocument());
  });

  it.each([[null], [undefined], [[]]])('shows a source with workflows %p as read only', (workflows) => {
    // The API sends a null list for a source without workflows.
    render(<WorkflowBadges workflows={workflows as Array<'write' | 'branch'> | undefined} type="source" />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
  });

  it('does not show a source that allows edits as read only', () => {
    render(<WorkflowBadges workflows={['write']} type="source" />);

    expect(screen.queryByText('Read only')).not.toBeInTheDocument();
  });

  it('calls the branch workflow a merge request on GitLab', () => {
    render(<WorkflowBadges workflows={['branch']} type="gitlab" />);

    expect(screen.getByText('Merge request')).toBeInTheDocument();
    expect(screen.queryByText('Pull request')).not.toBeInTheDocument();
  });

  it('names the synchronized branch in the hover text', async () => {
    const { user } = render(<WorkflowBadges workflows={['write']} branch="release" />);

    await user.hover(screen.getByText('Direct push'));

    expect(await screen.findByText('Changes are committed straight to release.')).toBeInTheDocument();
  });

  it('presents opening the pull request as a step the person takes', async () => {
    const { user } = render(<WorkflowBadges workflows={['branch']} type="github" branch="main" />);

    await user.hover(screen.getByText('Pull request'));

    expect(
      await screen.findByText('Changes are saved to another branch, ready for you to open a pull request into main.')
    ).toBeInTheDocument();
  });

  it('asks for a merge request on GitLab', async () => {
    const { user } = render(<WorkflowBadges workflows={['branch']} type="gitlab" branch="main" />);

    await user.hover(screen.getByText('Merge request'));

    expect(
      await screen.findByText('Changes are saved to another branch, ready for you to open a merge request into main.')
    ).toBeInTheDocument();
  });

  it('does not advertise a git push on a local repository', () => {
    render(<WorkflowBadges workflows={['write']} type="local" />);

    expect(screen.queryByText('Direct push')).not.toBeInTheDocument();
  });

  it('still marks a local repository read only', () => {
    render(<WorkflowBadges workflows={[]} type="local" />);

    expect(screen.getByText('Read only')).toBeInTheDocument();
  });
});
