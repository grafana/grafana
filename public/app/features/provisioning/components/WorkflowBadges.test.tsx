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
});
