import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { BannerDismissButton } from './BannerDismissButton';

const colors = { backgroundColor: '#3d71d9', textColor: '#ffffff' };

describe('BannerDismissButton', () => {
  it('renders a button and calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(
      <BannerDismissButton {...colors} onClick={onClick}>
        Dismiss
      </BannerDismissButton>
    );
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('always renders a button element', () => {
    render(<BannerDismissButton {...colors}>Dismiss</BannerDismissButton>);
    expect(screen.getByRole('button', { name: 'Dismiss' }).tagName).toBe('BUTTON');
  });

  it('renders a button element even when an `as` prop gets past the types', () => {
    render(
      // @ts-expect-error BannerDismissButton has no `as` prop, so it cannot render as an anchor
      <BannerDismissButton {...colors} as="a">
        Dismiss
      </BannerDismissButton>
    );
    expect(screen.getByRole('button', { name: 'Dismiss' }).tagName).toBe('BUTTON');
  });

  it('renders with a background color in any CSS color format, such as oklch()', () => {
    render(
      <BannerDismissButton backgroundColor="oklch(49.1% 0.1174 292.58)" textColor="#ffffff">
        Dismiss
      </BannerDismissButton>
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('uses the given background and text colors', () => {
    render(<BannerDismissButton {...colors}>Dismiss</BannerDismissButton>);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveStyle({
      background: '#3d71d9',
      color: '#ffffff',
    });
  });
});
