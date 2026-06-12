import { useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { type RepositoryFormData } from '../types';

import { BranchOptionsSection } from './BranchOptionsSection';

function Wrapper() {
  const { register } = useForm<RepositoryFormData>();
  return (
    <BranchOptionsSection<RepositoryFormData>
      register={register}
      nameTemplateName="branchOptions.nameTemplate"
      enforceTemplateName="branchOptions.enforceTemplate"
    />
  );
}

describe('BranchOptionsSection', () => {
  beforeEach(() => {
    // Default to the gitConventions flag being enabled; specific tests override.
    setTestFlags({ 'provisioning.gitConventions': true });
  });

  afterEach(async () => {
    // setTestFlags fires OpenFeature events that update mounted components, so reset within act().
    await act(async () => {
      setTestFlags({});
    });
  });

  it('renders nothing when the gitConventions flag is off', () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { container } = render(<Wrapper />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders collapsed by default, hiding the inner fields', () => {
    render(<Wrapper />);

    expect(screen.getByText('Branch options (advanced)')).toBeInTheDocument();
    // Collapse renders its children only when open
    expect(screen.queryByText('Branch name template')).not.toBeInTheDocument();
  });

  it('reveals the branch name template and enforcement fields when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Branch options (advanced)'));

    expect(screen.getByText('Branch name template')).toBeInTheDocument();
    expect(screen.getByText('Enforce branch name template')).toBeInTheDocument();
  });

  it('registers the inputs under the provided spec paths', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Branch options (advanced)'));

    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'branchOptions.nameTemplate');
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'branchOptions.enforceTemplate');
  });
});
