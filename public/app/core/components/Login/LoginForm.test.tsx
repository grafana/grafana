import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('marks the username field for passkey autofill (Conditional UI)', () => {
    render(
      <LoginForm onSubmit={jest.fn()} isLoggingIn={false} passwordHint="" loginHint="">
        <span />
      </LoginForm>
    );

    // The "webauthn" token is what lets the browser offer an enrolled passkey in the username field's
    // autofill. Without it the conditional ceremony has no input to attach to.
    expect(screen.getByTestId(selectors.pages.Login.username)).toHaveAttribute('autocomplete', 'username webauthn');
  });
});
