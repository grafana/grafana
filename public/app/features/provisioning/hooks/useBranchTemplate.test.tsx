import { useForm } from 'react-hook-form';
import { render, screen, waitFor } from 'test/test-utils';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type BranchTemplateVars } from '../utils/branchName';

import { useBranchTemplate } from './useBranchTemplate';

const TEMPLATE = 'grafana/{{action}}-{{title}}';
const dashboardVars: BranchTemplateVars = {
  action: 'create',
  resourceKind: 'dashboard',
  title: 'Test',
  userLogin: 'ada',
};

function makeRepo(
  branchOptions?: RepositoryView['branchOptions'],
  workflows: RepositoryView['workflows'] = ['branch', 'write']
): RepositoryView {
  return {
    name: 'repo',
    title: 'Repo',
    target: 'folder',
    type: 'github',
    workflows,
    branchOptions,
  };
}

interface HostProps {
  repository?: RepositoryView;
  vars: BranchTemplateVars;
  isNewBranch?: boolean;
  defaultRef?: string;
  /** When set, renders a button that reruns reset() with this ref, mirroring the Save drawer's
   *  reset(defaultValues, { keepDirtyValues }) overwriting the non-dirty ref on a parent re-render. */
  resetTo?: string;
}

function Host({ repository, vars, isNewBranch = true, defaultRef = '', resetTo }: HostProps) {
  const methods = useForm<{ ref?: string }>({ defaultValues: { ref: defaultRef } });
  const { locked } = useBranchTemplate({
    repository,
    vars,
    isNewBranch,
    value: methods.watch('ref') ?? '',
    isDirty: Boolean(methods.formState.dirtyFields.ref),
    setBranch: (v) => methods.setValue('ref', v, { shouldDirty: false }),
  });
  // Mirror the shared field's `ref` Controller: a single controlled input whose value lives in the
  // form `ref` (driven by the template effect) and that becomes read-only when the template is enforced.
  return (
    <>
      <input
        aria-label="branch"
        value={methods.watch('ref') ?? ''}
        readOnly={locked}
        onChange={(e) => methods.setValue('ref', e.currentTarget.value, { shouldDirty: true })}
      />
      <output data-testid="locked">{String(locked)}</output>
      {resetTo !== undefined && (
        <button type="button" onClick={() => methods.reset({ ref: resetTo }, { keepDirtyValues: true })}>
          reset
        </button>
      )}
    </>
  );
}

describe('useBranchTemplate', () => {
  it('leaves the field untouched when the ref is not a new branch', () => {
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE })} vars={dashboardVars} isNewBranch={false} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(input).toHaveValue('');
  });

  it('keeps a branch name the user typed once the ref becomes a new branch', async () => {
    // Typing a name is how the user enters new-branch mode, and it may happen before the refs
    // lookup confirms the name is new. The template is a default, so it never replaces an edit.
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender, user } = render(
      <Host repository={repository} vars={dashboardVars} isNewBranch={false} defaultRef="dashboard/2026-abc" />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    await user.clear(input);
    await user.type(input, 'feature/my-choice');
    expect(input).toHaveValue('feature/my-choice');

    rerender(<Host repository={repository} vars={dashboardVars} isNewBranch defaultRef="dashboard/2026-abc" />);
    // Give the template effect a chance to run; it must leave the edit alone.
    await waitFor(() => expect(input).toHaveValue('feature/my-choice'));
    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} isNewBranch />);
    expect(input).toHaveValue('feature/my-choice');
  });

  it('fills the generated branch once the pending lookup confirms it is new', async () => {
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender } = render(
      <Host repository={repository} vars={dashboardVars} isNewBranch={false} defaultRef="dashboard/2026-abc" />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(input).toHaveValue('dashboard/2026-abc');

    rerender(<Host repository={repository} vars={dashboardVars} isNewBranch defaultRef="dashboard/2026-abc" />);
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
  });

  it('generates a {{random}} token and renders it into the branch name', async () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
    try {
      render(<Host repository={makeRepo({ nameTemplate: 'b/{{random}}' })} vars={dashboardVars} />);
      const input = screen.getByRole('textbox', { name: /branch/i });
      await waitFor(() => expect(input).toHaveValue('b/aaaaaa'));
    } finally {
      spy.mockRestore();
    }
  });

  it('re-applies the enforced template after a form reset overwrites the ref', async () => {
    // The Save drawer runs reset(defaultValues, { keepDirtyValues }) whenever the parent re-renders
    // (e.g. selecting a target folder), overwriting the hook's non-dirty ref. Because the enforced
    // field is read-only, the hook must treat that as a reset (not a user edit) and reassert the
    // template instead of freezing on the generated branch.
    const repository = makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true });
    const { user } = render(<Host repository={repository} vars={dashboardVars} resetTo="dashboard/2023-01-01-xyz" />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));

    await user.click(screen.getByRole('button', { name: /reset/i }));

    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).toHaveAttribute('readonly');
  });

  it('applies and locks an enforced template before the refs confirm the ref is new', async () => {
    // Enforcement must not wait for the refs query: with isNewBranch still false the field is
    // filled from the template and locked read-only.
    render(
      <Host
        repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true })}
        vars={dashboardVars}
        isNewBranch={false}
      />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('locked')).toHaveTextContent('true');
  });

  it('does not lock when an enforced template renders empty, leaving the field editable', async () => {
    // An enforced template whose render sanitises away (all-punctuation title) must not freeze the
    // field read-only on the auto-generated ref — the user needs to be able to set a valid branch.
    render(
      <Host
        repository={makeRepo({ nameTemplate: '{{title}}', enforceTemplate: true })}
        vars={{ ...dashboardVars, title: '!!!' }}
        defaultRef="dashboard/2023-abc"
      />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(screen.getByTestId('locked')).toHaveTextContent('false');
    expect(input).not.toHaveAttribute('readonly');
    await waitFor(() => expect(input).toHaveValue('dashboard/2023-abc'));
  });
});
