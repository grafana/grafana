import { useForm, useFormState } from 'react-hook-form';
import { act, render, screen, waitFor } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';
import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { type WorkflowOption } from '../types';
import { type BranchTemplateVars } from '../utils/branchName';

import { useBranchTemplate } from './useBranchTemplate';

const TEMPLATE = 'grafana/{{action}}-{{title}}';
const dashboardVars: BranchTemplateVars = {
  action: 'create',
  resourceKind: 'dashboard',
  title: 'Test',
  userLogin: 'ada',
};

function makeRepo(branchOptions?: RepositoryView['branchOptions']): RepositoryView {
  return {
    name: 'repo',
    title: 'Repo',
    target: 'folder',
    type: 'github',
    workflows: ['branch', 'write'],
    branchOptions,
  };
}

function Host({
  repository,
  vars,
  workflow = 'branch',
  defaultRef = '',
}: {
  repository?: RepositoryView;
  vars: BranchTemplateVars;
  workflow?: WorkflowOption;
  defaultRef?: string;
}) {
  const methods = useForm<{ ref?: string }>({ defaultValues: { ref: defaultRef } });
  const { dirtyFields } = useFormState({ control: methods.control });
  const { locked } = useBranchTemplate({
    repository,
    vars,
    workflow,
    branch: methods.watch('ref') ?? '',
    isBranchDirty: Boolean(dirtyFields.ref),
    setBranch: (v) => methods.setValue('ref', v, { shouldDirty: false }),
  });
  // Mirror the shared field's `ref` Controller: a single controlled input whose value lives in the
  // form `ref` (driven by the pre-fill effect) and that becomes read-only when the template is enforced.
  return (
    <>
      <input
        aria-label="branch"
        value={methods.watch('ref') ?? ''}
        readOnly={locked}
        onChange={(e) => methods.setValue('ref', e.currentTarget.value, { shouldDirty: true })}
      />
      <output data-testid="locked">{String(locked)}</output>
    </>
  );
}

describe('useBranchTemplate', () => {
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
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE })} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(input).toHaveValue('');
    expect(screen.getByTestId('locked')).toHaveTextContent('false');
  });

  it('leaves the field untouched for the write workflow', () => {
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE })} vars={dashboardVars} workflow="write" />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    expect(input).toHaveValue('');
  });

  it('pre-fills the branch field from the rendered template on the branch workflow', async () => {
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

  it('stops overwriting the field once the user edits it', async () => {
    const repository = makeRepo({ nameTemplate: TEMPLATE });
    const { rerender, user } = render(<Host repository={repository} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));

    await user.type(input, 'x');
    expect(input).toHaveValue('grafana/create-testx');

    // A later variable change must not clobber the user's edit.
    rerender(<Host repository={repository} vars={{ ...dashboardVars, title: 'Renamed' }} />);
    expect(input).toHaveValue('grafana/create-testx');
  });

  it('reports locked and keeps the field read-only when enforcement is on', async () => {
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true })} vars={dashboardVars} />);

    const input = screen.getByRole('textbox', { name: /branch/i });
    await waitFor(() => expect(input).toHaveValue('grafana/create-test'));
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByTestId('locked')).toHaveTextContent('true');
  });

  it('does not lock when the flag is off even with enforcement configured', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    render(<Host repository={makeRepo({ nameTemplate: TEMPLATE, enforceTemplate: true })} vars={dashboardVars} />);

    expect(screen.getByTestId('locked')).toHaveTextContent('false');
    expect(screen.getByRole('textbox', { name: /branch/i })).not.toHaveAttribute('readonly');
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
    // Give the autofill effect a chance to run; it must be a no-op here.
    await waitFor(() => expect(input).toHaveValue('dashboard/2023-abc'));
  });
});
