import { render, screen } from '@testing-library/react';
import { type UseFormRegister } from 'react-hook-form';

import { type RepositoryFormData } from '../types';

import { GitHubDashboardPreviewField } from './GitHubDashboardPreviewField';

function setup(options: { disabled?: boolean } = {}) {
  const registerMock = jest.fn().mockReturnValue({});

  render(
    <GitHubDashboardPreviewField
      register={registerMock as unknown as UseFormRegister<RepositoryFormData>}
      disabled={options.disabled}
    />
  );

  return { registerMock };
}

describe('GitHubDashboardPreviewField', () => {
  it('renders the previews checkbox and registers generateDashboardPreviews', () => {
    const { registerMock } = setup();

    const checkbox = screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i });
    expect(checkbox).toBeEnabled();
    expect(registerMock).toHaveBeenCalledWith('generateDashboardPreviews');
  });

  it('disables the checkbox when disabled is set', () => {
    setup({ disabled: true });

    expect(screen.getByRole('checkbox', { name: /Enable dashboard previews in pull requests/i })).toBeDisabled();
  });
});
