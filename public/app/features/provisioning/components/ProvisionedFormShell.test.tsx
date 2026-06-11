import { render, screen } from 'test/test-utils';

import { ProvisionedFormShell, type ProvisionedFormShellProps } from './ProvisionedFormShell';

function setup(props: Partial<ProvisionedFormShellProps> = {}) {
  return render(
    <ProvisionedFormShell {...props}>
      <div data-testid="form-content">Form content</div>
    </ProvisionedFormShell>
  );
}

describe('ProvisionedFormShell', () => {
  it('renders children when all flags are false', () => {
    setup();
    expect(screen.getByTestId('form-content')).toBeInTheDocument();
  });

  it('renders a spinner when loading', () => {
    setup({ isLoading: true });
    expect(screen.getByTestId('Spinner')).toBeInTheDocument();
    expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
  });

  it('renders the orphaned notice when orphaned', () => {
    setup({ isOrphaned: true });
    expect(screen.getByText('Provisioning repository no longer exists')).toBeInTheDocument();
    expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
  });

  it('renders the error alert when error', () => {
    setup({ isError: true, error: { error: { message: 'Something failed' } } });
    expect(screen.getByText('Error loading form')).toBeInTheDocument();
    expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
  });

  it('renders the missing repository banner when repo is missing', () => {
    setup({ isMissingRepo: true });
    expect(screen.getByText('Repository not found')).toBeInTheDocument();
    expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
  });

  it('renders the read-only banner when read-only', () => {
    setup({ isReadOnly: true });
    expect(screen.getByText('This repository is read only')).toBeInTheDocument();
    expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
  });

  it('renders the read-only banner with a custom message', () => {
    setup({ isReadOnly: true, readOnlyMessage: 'Custom read-only instructions.' });
    expect(screen.getByText(/Custom read-only instructions./)).toBeInTheDocument();
  });

  describe('priority order', () => {
    it('prioritizes loading over orphaned', () => {
      setup({ isLoading: true, isOrphaned: true });
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(screen.queryByText('Provisioning repository no longer exists')).not.toBeInTheDocument();
    });

    it('prioritizes orphaned over error', () => {
      setup({ isOrphaned: true, isError: true });
      expect(screen.getByText('Provisioning repository no longer exists')).toBeInTheDocument();
      expect(screen.queryByText('Error loading form')).not.toBeInTheDocument();
    });

    it('prioritizes error over missing repository', () => {
      setup({ isError: true, isMissingRepo: true });
      expect(screen.getByText('Error loading form')).toBeInTheDocument();
      expect(screen.queryByText('Repository not found')).not.toBeInTheDocument();
    });

    it('prioritizes missing repository over read-only', () => {
      setup({ isMissingRepo: true, isReadOnly: true });
      expect(screen.getByText('Repository not found')).toBeInTheDocument();
      expect(screen.queryByText('This repository is read only')).not.toBeInTheDocument();
    });

    it('ignores the read-only message when the repository is missing', () => {
      setup({ isMissingRepo: true, isReadOnly: true, readOnlyMessage: 'Custom read-only instructions.' });
      expect(screen.getByText('Repository not found')).toBeInTheDocument();
      expect(screen.queryByText(/Custom read-only instructions./)).not.toBeInTheDocument();
    });

    it('renders only the spinner when every flag is set', () => {
      setup({ isLoading: true, isOrphaned: true, isError: true, isMissingRepo: true, isReadOnly: true });
      expect(screen.getByTestId('Spinner')).toBeInTheDocument();
      expect(screen.queryByText('Provisioning repository no longer exists')).not.toBeInTheDocument();
      expect(screen.queryByText('Error loading form')).not.toBeInTheDocument();
      expect(screen.queryByText('Repository not found')).not.toBeInTheDocument();
      expect(screen.queryByText('This repository is read only')).not.toBeInTheDocument();
      expect(screen.queryByTestId('form-content')).not.toBeInTheDocument();
    });
  });
});
