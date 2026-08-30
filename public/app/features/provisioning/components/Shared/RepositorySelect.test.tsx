import { render, screen } from 'test/test-utils';

import { type RepositoryView } from 'app/api/clients/provisioning/v0alpha1';

import { RepositorySelect } from './RepositorySelect';

const repos: RepositoryView[] = [
  { name: 'repo-one', title: 'Repo One', target: 'instance', type: 'git', workflows: [] },
  // Empty title falls back to the name.
  { name: 'repo-two', title: '', target: 'folderless', type: 'github', workflows: [] },
];

describe('RepositorySelect', () => {
  it('renders the label, default description and a combobox', () => {
    render(<RepositorySelect repositories={repos} value="" onChange={jest.fn()} />);

    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText(/store this resource in version control/i)).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('uses a custom description when provided', () => {
    render(<RepositorySelect repositories={repos} value="" onChange={jest.fn()} description="Custom help text" />);

    expect(screen.getByText('Custom help text')).toBeInTheDocument();
  });

  it('disables the combobox when read-only', () => {
    render(<RepositorySelect repositories={repos} value="repo-one" onChange={jest.fn()} readOnly />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('keeps a selected-but-missing repository visible (orphaned fallback)', () => {
    render(<RepositorySelect repositories={repos} value="orphan-repo" onChange={jest.fn()} readOnly />);

    expect(screen.getByDisplayValue('orphan-repo')).toBeInTheDocument();
  });

  it('calls onChange with the selected repository name', async () => {
    const onChange = jest.fn();
    const { user } = render(<RepositorySelect repositories={repos} value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole('combobox'));
    // Options are virtualized in jsdom; select via the keyboard.
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onChange).toHaveBeenCalledTimes(1);
    // A configured repository name is reported (not the empty "no repository" value).
    expect(['repo-one', 'repo-two']).toContain(onChange.mock.calls[0][0]);
  });
});
