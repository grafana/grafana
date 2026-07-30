import { fireEvent, render, screen, userEvent } from 'test/test-utils';

import { type ToggletipProps } from '@grafana/ui';

import { QueryOptions } from './QueryOptions';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Toggletip: ({ children, content, onClose }: ToggletipProps) => (
    <>
      {children}
      <button type="button" onClick={onClose}>
        Close options
      </button>
      {content}
    </>
  ),
}));

describe('QueryOptions', () => {
  it('saves max data points when the options toggletip closes', async () => {
    const onChangeQueryOptions = jest.fn();
    const user = userEvent.setup();

    render(
      <QueryOptions query={{} as never} queryOptions={{}} index={0} onChangeQueryOptions={onChangeQueryOptions} />
    );

    await user.click(screen.getByRole('button', { name: 'Options' }));
    await user.type(screen.getByRole('spinbutton'), '42');
    fireEvent.click(screen.getByRole('button', { name: 'Close options' }));

    expect(onChangeQueryOptions).toHaveBeenCalledWith({ maxDataPoints: 42 }, 0);
  });
});
