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

function Host(props: HostProps) {
  const { repository, vars, defaultRef = '', resetTo } = props;
  // An omitted prop defaults to a new branch; `isNewBranch={undefined}` passes the unresolved state
  // through so a test can prove enforcement does not wait for the refs query.
  const isNewBranch = 'isNewBranch' in props ? props.isNewBranch : true;
  const methods = useForm<{ ref?: string }>({ defaultValues: { ref: defaultRef } });
  const { locked } = useBranchTemplate({
    repository,
    vars,
    isNewBranch,
    value: methods.watch('ref') ?? '',
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

  it('applies the template once the ref becomes a new branch', async () => {
    // Typing a new branch name is the only way to reach the new-branch state; the template must
    // apply on that transition, not just when the drawer opens already on a new branch.
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender } = render(<Host repository={repository} vars={dashboardVars} isNewBranch={false} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(input).toHaveValue('');

    rerender(<Host repository={repository} vars={dashboardVars} isNewBranch />);
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
  });

  it('pre-fills the branch field from the rendered template when the ref is a new branch', async () => {
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE })} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).not.toHaveAttribute('readonly');
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

  it('re-renders the field as the template variables change', async () => {
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender } = render(<Host repository={repository} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));

    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} />);
    await waitFor(() => expect(input).toHaveValue('grafana/create-renamed'));
  });

  it('freezes after a manual edit so a later variable change keeps the user value', async () => {
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender, user } = render(<Host repository={repository} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));

    await user.type(input, 'x');
    expect(input).toHaveValue('grafana/create-testx');

    // The user has edited the field, so a later variable change must NOT overwrite their value.
    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} />);
    expect(input).toHaveValue('grafana/create-testx');
  });

  it('keeps a manual edit while the template variables are unchanged', async () => {
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender, user } = render(<Host repository={repository} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));

    await user.type(input, 'x');
    expect(input).toHaveValue('grafana/create-testx');

    // Re-render with the same vars: the rendered name is unchanged, so the manual edit survives.
    rerender(<Host repository={repository} vars={dashboardVars} />);
    expect(input).toHaveValue('grafana/create-testx');
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

  it('reports locked and keeps the field read-only when enforcement is on', async () => {
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true })} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('locked')).toHaveTextContent('true');
  });

  it('applies and locks an enforced template while the ref is still resolving', async () => {
    // Enforcement must not wait for the refs query: with isNewBranch unresolved the field is still
    // filled from the template and locked read-only.
    render(
      <Host
        repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true })}
        vars={dashboardVars}
        isNewBranch={undefined}
      />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('locked')).toHaveTextContent('true');
  });

  it('does not enforce the template on a write-only repository', async () => {
    // The enforcement guard needs the branch workflow; a write-only repo never leaves the configured
    // branch, so the field keeps its value and stays editable.
    render(
      <Host
        repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true }, ['write'])}
        vars={dashboardVars}
        isNewBranch={false}
        defaultRef="main"
      />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(screen.getByTestId('locked')).toHaveTextContent('false');
    expect(input).not.toHaveAttribute('readonly');
    await waitFor(() => expect(input).toHaveValue('main'));
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

  it('does not lock when enforcement is set but no template is configured', async () => {
    // Nothing to enforce without a template, so the field stays editable on its existing value
    // rather than freezing read-only on an auto-generated ref.
    render(
      <Host repository={makeRepo({ enforceTemplate: true })} vars={dashboardVars} defaultRef="dashboard/2023-abc" />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(screen.getByTestId('locked')).toHaveTextContent('false');
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveValue('dashboard/2023-abc');
  });

  it('leaves the existing ref untouched when the rendered name sanitises to empty', async () => {
    // A title made up entirely of punctuation sanitises away; the field must keep its valid default
    // rather than being wiped to an empty (invalid) ref.
    render(
      <Host
        repository={makeRepo({ nameTemplate: '{{title}}' })}
        vars={{ ...dashboardVars, title: '!!!' }}
        defaultRef="dashboard/2023-abc"
      />
    );

    const input = screen.getByRole('textbox', { name: /branch/i });
    // Give the template effect a chance to run; it must be a no-op here.
    await waitFor(() => expect(input).toHaveValue('dashboard/2023-abc'));
  });
});
