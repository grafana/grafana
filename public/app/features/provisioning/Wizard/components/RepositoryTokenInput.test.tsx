import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RepoType, type WizardFormData } from '../types';

import { RepositoryTokenInput } from './RepositoryTokenInput';

function Wrapper({ type }: { type: RepoType }) {
  const methods = useForm<WizardFormData>({
    defaultValues: {
      repository: { type, token: 'token' },
    },
  });
  return (
    <FormProvider {...methods}>
      <RepositoryTokenInput />
      <button onClick={methods.handleSubmit(() => {})}>Submit</button>
    </FormProvider>
  );
}

function setup(type: RepoType) {
  return render(<Wrapper type={type} />);
}

describe('RepositoryTokenInput', () => {
  it('does not render the email field for github repositories', () => {
    setup('github');

    expect(screen.queryByLabelText(/Atlassian account email/)).not.toBeInTheDocument();
  });

  describe('bitbucket email', () => {
    it('renders the email field', () => {
      setup('bitbucket');

      expect(screen.getByLabelText(/Atlassian account email/)).toBeInTheDocument();
    });

    it('rejects an invalid email', async () => {
      const { user } = setup('bitbucket');

      await user.type(screen.getByLabelText(/Atlassian account email/), 'not-an-email');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('accepts a valid email', async () => {
      const { user } = setup('bitbucket');

      await user.type(screen.getByLabelText(/Atlassian account email/), 'you@example.com');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
    });

    it('accepts an empty email', async () => {
      const { user } = setup('bitbucket');

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(screen.queryByText('Enter a valid email address')).not.toBeInTheDocument();
    });
  });
});
