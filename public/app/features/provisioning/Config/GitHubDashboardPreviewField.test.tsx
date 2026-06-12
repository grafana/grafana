import { useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type RepositoryFormData } from '../types';

import { GitHubDashboardPreviewField } from './GitHubDashboardPreviewField';

function Wrapper({ disabled }: { disabled?: boolean }) {
  const { register } = useForm<RepositoryFormData>();
  return <GitHubDashboardPreviewField register={register} disabled={disabled} />;
}

describe('GitHubDashboardPreviewField', () => {
  it('renders the previews checkbox and registers generateDashboardPreviews', () => {
    render(<Wrapper />);

    const checkbox = screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i });
    expect(checkbox).toBeEnabled();
    expect(checkbox).toHaveAttribute('name', 'generateDashboardPreviews');
  });

  it('disables the checkbox when disabled is set', () => {
    render(<Wrapper disabled />);

    expect(screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i })).toBeDisabled();
  });
});
