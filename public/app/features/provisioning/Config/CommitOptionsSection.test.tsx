import { type DefaultValues, useForm } from 'react-hook-form';
import { act, render, screen } from 'test/test-utils';

import { setTestFlags } from '@grafana/test-utils/unstable';

import { type RepositoryFormData } from '../types';

import { CommitOptionsSection } from './CommitOptionsSection';

interface WrapperProps {
  defaultSigningKeyConfigured?: boolean;
  defaultValues?: DefaultValues<RepositoryFormData>;
  onSubmit?: () => void;
}

function Wrapper({ defaultSigningKeyConfigured, defaultValues, onSubmit = () => {} }: WrapperProps = {}) {
  const { register, control, setValue, handleSubmit } = useForm<RepositoryFormData>({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <CommitOptionsSection<RepositoryFormData>
        register={register}
        control={control}
        setValue={setValue}
        messageTemplateName="commit.singleResourceMessageTemplate"
        enforceTemplateName="commit.enforceTemplate"
        type="github"
        signingMethodName="signingMethod"
        signingKeyName="commitSigningKey"
        smimeCertificateName="smimeCertificate"
        signerNameName="commit.signerName"
        signerEmailName="commit.signerEmail"
        defaultSigningKeyConfigured={defaultSigningKeyConfigured}
      />
      <button type="submit">Submit</button>
    </form>
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

    expect(screen.getByText('Commit options (advanced)')).toBeInTheDocument();
    // Collapse renders its children only when open
    expect(screen.queryByText('Commit message template')).not.toBeInTheDocument();
  });

  it('reveals the commit message template and enforcement fields when expanded', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.getByText('Enforce commit message template')).toBeInTheDocument();
  });

  it('renders the placeholder with literal {{action}} / {{title}} variables', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByPlaceholderText('feat(dashboards): {{action}} {{title}}')).toBeInTheDocument();
  });

  it('describes the available placeholders with their double-brace form', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(
      screen.getByText(
        /\{\{action\}\} \(create\/update\/delete\/move\/rename\), \{\{resourceKind\}\} \(dashboard\/folder\), \{\{resourceID\}\}, \{\{title\}\}/
      )
    ).toBeInTheDocument();
  });

  it('registers the inputs under the provided spec paths', async () => {
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByRole('textbox')).toHaveAttribute('name', 'commit.singleResourceMessageTemplate');
    expect(screen.getByRole('checkbox')).toHaveAttribute('name', 'commit.enforceTemplate');
  });

  it('hides the enforce option when the gitConventions flag is off but keeps the message template', async () => {
    setTestFlags({ 'provisioning.gitConventions': false });
    const { user } = render(<Wrapper />);

    await user.click(screen.getByText('Commit options (advanced)'));

    expect(screen.getByText('Commit message template')).toBeInTheDocument();
    expect(screen.queryByText('Enforce commit message template')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  describe('commit signing', () => {
    it('keeps the signing method selectable with no reset button when a key is configured but no method is selected', async () => {
      const { user } = render(<Wrapper defaultSigningKeyConfigured />);

      await user.click(screen.getByText('Commit options (advanced)'));

      expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'None' })).toBeEnabled();
    });
    it('blocks submit until key, signer name and signer email are set when a method is selected', async () => {
      const onSubmit = jest.fn();
      const { user } = render(<Wrapper onSubmit={onSubmit} />);

      await user.click(screen.getByText('Commit options (advanced)'));
      await user.click(screen.getByLabelText('GPG'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findByText('Signing key is required')).toBeInTheDocument();
      expect(screen.getAllByText('Required when commit signing is enabled.')).toHaveLength(2);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('also requires the certificate for smime', async () => {
      const onSubmit = jest.fn();
      const { user } = render(<Wrapper onSubmit={onSubmit} />);

      await user.click(screen.getByText('Commit options (advanced)'));
      await user.click(screen.getByLabelText('S/MIME'));
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findByText('Certificate is required')).toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits when method, key, signer name and signer email are all set', async () => {
      const onSubmit = jest.fn();
      const { user } = render(<Wrapper onSubmit={onSubmit} />);

      await user.click(screen.getByText('Commit options (advanced)'));
      await user.click(screen.getByLabelText('GPG'));
      await user.type(screen.getByLabelText(/Signing key/), 'key-material');
      await user.type(screen.getByLabelText(/Signer name/), 'Jane Doe');
      await user.type(screen.getByLabelText(/Signer email/), 'jane@example.com');
      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('submits without any signing fields when no method is selected', async () => {
      const onSubmit = jest.fn();
      const { user } = render(<Wrapper onSubmit={onSubmit} />);

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(onSubmit).toHaveBeenCalled();
    });

    it('still requires the signer fields when the key is already configured', async () => {
      const onSubmit = jest.fn();
      const { user } = render(
        <Wrapper defaultSigningKeyConfigured defaultValues={{ signingMethod: 'gpg' }} onSubmit={onSubmit} />
      );

      await user.click(screen.getByRole('button', { name: 'Submit' }));

      expect(await screen.findAllByText('Required when commit signing is enabled.')).toHaveLength(2);
      expect(screen.queryByText('Signing key is required')).not.toBeInTheDocument();
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
