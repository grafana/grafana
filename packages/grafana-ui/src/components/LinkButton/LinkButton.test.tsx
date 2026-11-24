import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { JSX } from 'react';

import { Tooltip } from '../Tooltip/Tooltip';

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

  it('calls onFocus and onBlur when the link gains and loses keyboard focus', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    setup(
      <>
        <LinkButton href="https://grafana.com" onFocus={onFocus} onBlur={onBlur}>
          Click me
        </LinkButton>
        <button>Next</button>
      </>
    );

    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Click me' })).toHaveFocus();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onBlur).not.toHaveBeenCalled();

    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps onFocus and onBlur working when the link also has a tooltip', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    setup(
      <>
        <LinkButton href="https://grafana.com" tooltip="More about Grafana" onFocus={onFocus} onBlur={onBlur}>
          Click me
        </LinkButton>
        <button>Next</button>
      </>
    );

    await userEvent.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('More about Grafana');

    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps onFocus and onBlur working when the link is wrapped in a Tooltip', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    setup(
      <>
        <Tooltip content="More about Grafana">
          <LinkButton href="https://grafana.com" onFocus={onFocus} onBlur={onBlur}>
            Click me
          </LinkButton>
        </Tooltip>
        <button>Next</button>
      </>
    );

    await userEvent.tab();
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('More about Grafana');

    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
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
});
