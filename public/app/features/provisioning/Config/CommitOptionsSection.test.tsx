import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

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
  it('renders collapsed by default, hiding the inner fields', () => {
    render(<Wrapper />);

    expect(screen.getByText('Commit options (advanced)')).toBeInTheDocument();
    // Collapse renders its children only when open
    expect(screen.queryByText('Commit message template')).not.toBeInTheDocument();
  });

  it('reveals the commit message template and enforcement fields when expanded', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.getByText('Enforce commit message template')).toBeInTheDocument();
  });

  it('renders the placeholder with literal {{action}} / {{title}} variables', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByPlaceholderText('feat(dashboards): {{action}} {{title}}')).toBeInTheDocument();
  });

  it('describes the available placeholders with their double-brace form', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(
      screen.getByText(
        /\{\{action\}\} \(create\/update\/delete\/move\/rename\), \{\{resourceKind\}\} \(dashboard\/folder\), \{\{resourceID\}\}, \{\{title\}\}/
      )
    ).toBeInTheDocument();
  });

  it('registers the inputs under the provided spec paths', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'commit.singleResourceMessageTemplate');
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'commit.enforceTemplate');
  });
});
