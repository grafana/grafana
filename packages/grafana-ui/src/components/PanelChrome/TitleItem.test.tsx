import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Dropdown } from '../Dropdown/Dropdown';
import { Icon } from '../Icon/Icon';

import { TitleItem } from './TitleItem';

describe('TitleItem', () => {
  it('works as a dropdown trigger, keeping its label and the props the dropdown adds', async () => {
    render(
      <Dropdown overlay={<div>Link menu</div>}>
        <TitleItem aria-label="Panel links">
          <Icon name="external-link-alt" />
        </TitleItem>
      </Dropdown>
    );

    const trigger = screen.getByRole('button', { name: 'Panel links' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(trigger);

    expect(screen.getByText('Link menu')).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('shows its title on a button', () => {
    render(
      <TitleItem title="Stop query" onClick={jest.fn()}>
        <Icon name="sync-slash" />
      </TitleItem>
    );

    expect(screen.getByRole('button')).toHaveAttribute('title', 'Stop query');
  });
});
