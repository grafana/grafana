import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { type Field, type LinkModel } from '@grafana/data';

import { DataLinkButton } from './DataLinkButton';

function makeLink(overrides?: Partial<LinkModel<Field>>): LinkModel<Field> {
  return {
    href: '/some-link',
    title: 'My Link',
    target: '_blank',
    origin: {} as Field,
    ...overrides,
  };
}

describe('DataLinkButton', () => {
  it('renders with title and href', () => {
    render(<DataLinkButton link={makeLink()} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', '/some-link');
    expect(screen.getByText('My Link')).toBeInTheDocument();
  });

  it('calls link.onClick and prevents default for regular clicks', async () => {
    const onClick = jest.fn();
    render(<DataLinkButton link={makeLink({ onClick })} />);

    await userEvent.click(screen.getByRole('link'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not call onClick when meta key is held', async () => {
    const user = userEvent.setup();
    const onClick = jest.fn();
    render(<DataLinkButton link={makeLink({ onClick })} />);

    await user.keyboard('{Meta>}');
    await user.click(screen.getByRole('link'));
    await user.keyboard('{/Meta}');

    expect(onClick).not.toHaveBeenCalled();
  });
});
