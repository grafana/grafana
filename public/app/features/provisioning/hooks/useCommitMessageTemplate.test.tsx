import { useForm, useFormState } from 'react-hook-form';
import { act, render, screen, waitFor } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type CommitTemplateVars, renderCommitMessage } from '../utils/commitMessage';

import { useCommitMessageTemplate } from './useCommitMessageTemplate';

const TEMPLATE = 'feat({{resourceKind}}s): {{action}} {{title}}';
const dashboardVars: CommitTemplateVars = {
  action: 'create',
  resourceKind: 'dashboard',
  resourceID: 'x',
  title: 'Test',
};

function makeRepo(commit?: RepositoryView['commit']): RepositoryView {
  return {
    name: 'repo',
    title: 'Repo',
    target: 'folder',
    type: 'github',
    workflows: ['branch', 'write'],
    commit,
  };
}

function Host({ repository, vars }: { repository?: RepositoryView; vars: CommitTemplateVars }) {
  const methods = useForm<{ comment?: string }>({ defaultValues: { comment: '' } });
  const { dirtyFields } = useFormState({ control: methods.control });
  const { locked } = useCommitMessageTemplate({
    repository,
    vars,
    comment: methods.watch('comment') ?? '',
    isCommentDirty: Boolean(dirtyFields.comment),
    setComment: (v) => methods.setValue('comment', v, { shouldDirty: false }),
  });
  return <textarea aria-label="comment" {...methods.register('comment')} readOnly={locked} />;
}

describe('useCommitMessageTemplate', () => {
  beforeEach(() => {
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('leaves the field untouched when the flag is off even with a template configured', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    render(<Host repository={makeRepo({ singleResourceMessageTemplate: TEMPLATE })} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    expect(textarea).toHaveValue('');
    expect(textarea).not.toHaveAttribute('readonly');
  });

  it('pre-fills the field from the rendered template when the flag is on', async () => {
    render(<Host repository={makeRepo({ singleResourceMessageTemplate: TEMPLATE })} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue('feat(dashboards): create Test'));
    expect(textarea).not.toHaveAttribute('readonly');
  });

  it('re-renders the field as the template variables change', async () => {
    const repository = makeRepo({ singleResourceMessageTemplate: TEMPLATE });
    const { rerender } = render(<Host repository={repository} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue('feat(dashboards): create Test'));

    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} />);
    await waitFor(() => expect(textarea).toHaveValue('feat(dashboards): create Renamed'));
  });

  it('stops overwriting the field once the user edits it', async () => {
    const repository = makeRepo({ singleResourceMessageTemplate: TEMPLATE });
    const { rerender, user } = render(<Host repository={repository} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue('feat(dashboards): create Test'));

    await user.type(textarea, '!');
    expect(textarea).toHaveValue('feat(dashboards): create Test!');

    // A later variable change must not clobber the user's edit.
    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} />);
    expect(textarea).toHaveValue('feat(dashboards): create Test!');
  });

  it('locks the field to the built-in default when enforcement is on without a template', async () => {
    render(<Host repository={makeRepo({ enforceTemplate: true })} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue(renderCommitMessage(undefined, dashboardVars)));
    expect(textarea).toHaveAttribute('readonly');
  });

  it('does not enforce when the flag is off', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    render(<Host repository={makeRepo({ enforceTemplate: true })} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    expect(textarea).toHaveValue('');
    expect(textarea).not.toHaveAttribute('readonly');
  });
});
