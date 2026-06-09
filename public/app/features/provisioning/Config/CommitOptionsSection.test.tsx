import { useBooleanFlagValue } from '@openfeature/react-sdk';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';

import { type RepositoryFormData } from '../types';

import { CommitOptionsSection } from './CommitOptionsSection';

jest.mock('@openfeature/react-sdk', () => ({
  useBooleanFlagValue: jest.fn(),
}));

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
    jest.mocked(useBooleanFlagValue).mockReturnValue(true);
  });
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

  it('hides the enforce option when the gitConventions flag is off but keeps the message template', async () => {
    jest.mocked(useBooleanFlagValue).mockReturnValue(false);
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.queryByText('Enforce commit message template')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});
