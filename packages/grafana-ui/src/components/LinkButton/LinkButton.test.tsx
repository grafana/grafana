import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { LinkButton } from './LinkButton';

const setup = (jsx: JSX.Element) => render(jsx);

describe('LinkButton', () => {
  it('should place the icon on the right when iconPlacement is "right"', () => {
    setup(
      <LinkButton icon="cloud" iconPlacement="right" href="https://grafana.com">
        Click me
      </LinkButton>
    );

    const link = screen.getByRole('link');
    const icon = screen.getByTitle('');
    const textSpan = link.querySelector('span');

    // Assert that the text span comes before the icon in the DOM
    expect(link.childNodes[0]).toBe(textSpan);
    expect(link.childNodes[1]).toBe(icon);
  });

  it('should place the icon on the left when iconPlacement is "left"', () => {
    setup(
      <LinkButton icon="cloud" iconPlacement="left" href="https://grafana.com">
        Click me
      </LinkButton>
    );

    const link = screen.getByRole('link');
    const icon = screen.getByTitle('');
    const textSpan = link.querySelector('span');

    // Assert that the icon comes before the text span in the DOM
    expect(link.childNodes[0]).toBe(icon);
    expect(link.childNodes[1]).toBe(textSpan);
  });

  it('sanitizes javascript: URLs in href', () => {
    setup(<LinkButton href="javascript:alert(1)">Click me</LinkButton>);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'about:blank');
  });

  it('preserves safe URLs in href', () => {
    setup(<LinkButton href="https://grafana.com/docs">Click me</LinkButton>);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://grafana.com/docs');
  });

  it('preserves relative URLs in href', () => {
    setup(<LinkButton href="/dashboards">Click me</LinkButton>);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboards');
  });

  it('omits href attribute when not provided', () => {
    setup(<LinkButton>No link</LinkButton>);
    expect(screen.getByText('No link').closest('a')).not.toHaveAttribute('href');
  });

  it('passes through empty string href unchanged', () => {
    setup(<LinkButton href="">Current page</LinkButton>);
    expect(screen.getByText('Current page').closest('a')).toHaveAttribute('href', '');
  });

  it('passes onFocus and onBlur to the link', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    setup(
      <LinkButton href="https://grafana.com" onFocus={onFocus} onBlur={onBlur}>
        Click me
      </LinkButton>
    );

    await userEvent.tab();
    expect(screen.getByRole('link')).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);

    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
