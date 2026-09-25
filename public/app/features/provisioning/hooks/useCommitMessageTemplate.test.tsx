import { useForm, useFormState } from 'react-hook-form';
import { act, render, screen, waitFor } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type CommitTemplateVars, getSingleResourceCommitMessage } from '../utils/commitMessage';

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

function Host({
  repository,
  vars,
  defaultComment = '',
  fallbackMessage,
}: {
  repository?: RepositoryView;
  vars: CommitTemplateVars;
  defaultComment?: string;
  fallbackMessage?: string;
}) {
  const methods = useForm<{ comment?: string }>({ defaultValues: { comment: defaultComment } });
  const { dirtyFields } = useFormState({ control: methods.control });
  const { locked, message } = useCommitMessageTemplate({
    repository,
    vars,
    comment: methods.watch('comment') ?? '',
    isCommentDirty: Boolean(dirtyFields.comment),
    setComment: (v) => methods.setValue('comment', v, { shouldDirty: false }),
    fallbackMessage,
  });
  // Mirror the shared field: an enforced repo renders the resolved message read-only; otherwise the
  // registered field is driven by the pre-fill effect. `message` is always surfaced for assertions.
  return (
    <>
      {locked ? (
        <textarea aria-label="comment" value={message} readOnly />
      ) : (
        <textarea aria-label="comment" {...methods.register('comment')} />
      )}
      <output data-testid="resolved-message">{message}</output>
    </>
  );
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
    const repository = makeRepo({ enforceTemplate: true });
    render(<Host repository={repository} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() =>
      expect(textarea).toHaveValue(getSingleResourceCommitMessage({ comment: '', repository, ...dashboardVars }))
    );
    expect(textarea).toHaveAttribute('readonly');
  });

  it('does not enforce when the flag is off', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    render(<Host repository={makeRepo({ enforceTemplate: true })} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    expect(textarea).toHaveValue('');
    expect(textarea).not.toHaveAttribute('readonly');
  });

  it('resolves the message to the edited comment for a non-enforced repo', async () => {
    const repository = makeRepo({ singleResourceMessageTemplate: TEMPLATE });
    const { user } = render(<Host repository={repository} vars={dashboardVars} />);

    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue('feat(dashboards): create Test'));

    await user.type(textarea, ' please');
    expect(textarea).toHaveValue('feat(dashboards): create Test please');
    expect(screen.getByTestId('resolved-message')).toHaveTextContent(
      getSingleResourceCommitMessage({ comment: 'feat(dashboards): create Test please', repository, ...dashboardVars })
    );
  });

  it('resolves the message to the rendered template when the user has not edited the comment', async () => {
    const repository = makeRepo({ singleResourceMessageTemplate: TEMPLATE });
    render(<Host repository={repository} vars={dashboardVars} />);

    await waitFor(() =>
      expect(screen.getByTestId('resolved-message')).toHaveTextContent(
        getSingleResourceCommitMessage({ comment: '', repository, ...dashboardVars })
      )
    );
  });

  it('forces the enforced template into the message, ignoring any comment value', async () => {
    const repository = makeRepo({ singleResourceMessageTemplate: TEMPLATE, enforceTemplate: true });
    render(<Host repository={repository} vars={dashboardVars} defaultComment="should be ignored" />);

    const expected = getSingleResourceCommitMessage({ comment: '', repository, ...dashboardVars });
    const textarea = screen.getByRole('textbox', { name: /comment/i });
    await waitFor(() => expect(textarea).toHaveValue(expected));
    expect(textarea).toHaveAttribute('readonly');
    expect(textarea).not.toHaveValue('should be ignored');
    expect(screen.getByTestId('resolved-message')).toHaveTextContent(expected);
  });

  describe('bulk fallback message', () => {
    const bulkVars: CommitTemplateVars = {
      action: 'delete',
      resourceID: '',
      title: '3 resources',
    };

    it('resolves to the supplied fallback when no template is configured', async () => {
      render(<Host repository={makeRepo()} vars={bulkVars} fallbackMessage="Delete resources" />);

      await waitFor(() => expect(screen.getByTestId('resolved-message')).toHaveTextContent('Delete resources'));
      // The single-resource built-in default ("Delete dashboard: ...") must not leak in.
      expect(screen.getByTestId('resolved-message')).not.toHaveTextContent('Delete dashboard');
    });

    it('renders the template and ignores the fallback when a template is configured', async () => {
      render(
        <Host
          repository={makeRepo({ singleResourceMessageTemplate: 'chore: {{action}} {{title}}' })}
          vars={bulkVars}
          fallbackMessage="Delete resources"
        />
      );

      const textarea = screen.getByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('chore: delete 3 resources'));
      expect(screen.getByTestId('resolved-message')).toHaveTextContent('chore: delete 3 resources');
    });

    it('renders a {{resourceKind}} placeholder as a generic noun instead of an empty token', async () => {
      render(
        <Host
          repository={makeRepo({ singleResourceMessageTemplate: 'feat({{resourceKind}}s): {{action}} {{title}}' })}
          vars={bulkVars}
          fallbackMessage="Delete resources"
        />
      );

      const textarea = screen.getByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('feat(resources): delete 3 resources'));
    });

    it('locks to the fallback message when enforcement is on without a template', async () => {
      render(
        <Host repository={makeRepo({ enforceTemplate: true })} vars={bulkVars} fallbackMessage="Delete resources" />
      );

      const textarea = screen.getByRole('textbox', { name: /comment/i });
      await waitFor(() => expect(textarea).toHaveValue('Delete resources'));
      expect(textarea).toHaveAttribute('readonly');
    });

    it('appends the saved-by trailer exactly once even when the template already includes one', async () => {
      const repository = makeRepo({
        singleResourceMessageTemplate: 'chore: {{action}}\n\nGrafana-saved-by: {{userName}}',
      });
      render(
        <Host
          repository={repository}
          vars={{ ...bulkVars, userName: 'Ada', userLogin: 'ada' }}
          fallbackMessage="Delete resources"
        />
      );

      await waitFor(() => {
        const text = screen.getByTestId('resolved-message').textContent ?? '';
        expect(text.match(/Grafana-saved-by:/g)).toHaveLength(1);
      });
    });
  });
});
