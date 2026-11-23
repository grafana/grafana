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
});
