import { useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { type RepositoryFormData } from '../types';

import { CommitOptionsSection } from './CommitOptionsSection';

function Wrapper() {
  const { register } = useForm<RepositoryFormData>();
  return (
    <CommitOptionsSection<RepositoryFormData>
      register={register}
      messageTemplateName="commit.singleResourceMessageTemplate"
      enforceTemplateName="commit.enforceTemplate"
    />
  );
}

describe('CommitOptionsSection', () => {
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

  it('renders collapsed by default, hiding the inner fields', () => {
    render(<Wrapper />);

    expect(screen.getByText('Commit options')).toBeInTheDocument();
    // Collapse renders its children only when open
    expect(screen.queryByText('Commit message template')).not.toBeInTheDocument();
  });

  it('reveals the commit message template and enforcement fields when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.getByText('Enforce commit message template')).toBeInTheDocument();
  });

  it('renders the placeholder with literal {{action}} / {{title}} variables', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options'));

    expect(screen.getByPlaceholderText('feat(dashboards): {{action}} {{title}}')).toBeInTheDocument();
  });

  it('describes the available placeholders with their double-brace form', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options'));

    expect(
      screen.getByText(
        /\{\{action\}\} \(create\/update\/delete\/move\/rename\), \{\{resourceKind\}\} \(dashboard\/folder\), \{\{resourceID\}\}, \{\{title\}\}/
      )
    ).toBeInTheDocument();
  });

  it('registers the inputs under the provided spec paths', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options'));

    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'commit.singleResourceMessageTemplate');
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'commit.enforceTemplate');
  });

  it('hides the enforce option when the gitConventions flag is off but keeps the message template', async () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.queryByText('Enforce commit message template')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
