import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { NamespaceContext, WrappedPlugins } from './plugins';

function Input({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  return <input aria-label="Namespace" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />;
}

const NamespaceForm = WrappedPlugins().wrapComponents.JsonSchemaForm(Input);

function Form({ namespace, initialValue }: { namespace?: string; initialValue?: string }) {
  const [value, onChange] = useState(initialValue);
  return (
    <NamespaceContext.Provider value={namespace}>
      <NamespaceForm description="namespace" required disabled={false} value={value} onChange={onChange} />
    </NamespaceContext.Provider>
  );
}

it.each([undefined, '', 'default'])(
  'initializes namespace from settings when the initial value is %s',
  async (initialValue) => {
    render(<Form namespace="stacks-31701" initialValue={initialValue} />);

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveValue('stacks-31701'));
  }
);

it('replaces the generic default when settings arrive after the form mounts', async () => {
  const { rerender } = render(<Form initialValue="default" />);
  expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveValue('default');

  rerender(<Form namespace="stacks-31701" initialValue="default" />);

  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveValue('stacks-31701'));
});

it('preserves an existing custom namespace', () => {
  render(<Form namespace="stacks-31701" initialValue="custom-namespace" />);

  expect(screen.getByRole('textbox', { name: 'Namespace' })).toHaveValue('custom-namespace');
});

it('allows the user to clear the namespace and enter default after initialization', async () => {
  const user = userEvent.setup();
  render(<Form namespace="stacks-31701" initialValue="default" />);
  const input = screen.getByRole('textbox', { name: 'Namespace' });
  await waitFor(() => expect(input).toHaveValue('stacks-31701'));

  await user.clear(input);
  expect(input).toHaveValue('');

  await user.type(input, 'default');
  expect(input).toHaveValue('default');
});
