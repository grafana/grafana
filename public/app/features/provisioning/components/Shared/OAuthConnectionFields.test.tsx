import { type ComponentProps } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { render, screen } from 'test/test-utils';

import { type ConnectionFormData } from '../../types';
import { getConnectionFormDefaults } from '../../utils/connectionData';

import { OAuthConnectionFields } from './OAuthConnectionFields';

function setup(props: Partial<ComponentProps<typeof OAuthConnectionFields>> = {}) {
  function Wrapper() {
    const methods = useForm<ConnectionFormData>({ defaultValues: getConnectionFormDefaults('githubOAuth') });
    return (
      <FormProvider {...methods}>
        <OAuthConnectionFields type="githubOAuth" onNewConnectionCreation={jest.fn()} {...props} />
      </FormProvider>
    );
  }
  return render(<Wrapper />);
}

describe('OAuthConnectionFields', () => {
  it('disables the create button and shows the pending label while authorization is pending', () => {
    setup({ isAuthorizing: true });

    expect(screen.getByRole('button', { name: /Waiting for authorization/i })).toBeDisabled();
  });

  it('disables the create button while the connection is being created', () => {
    setup({ isCreating: true });

    expect(screen.getByRole('button', { name: /Creating connection/i })).toBeDisabled();
  });

  it('enables the create button when neither creating nor authorizing', () => {
    setup();

    expect(screen.getByRole('button', { name: /Create and authorize/i })).toBeEnabled();
  });
});
