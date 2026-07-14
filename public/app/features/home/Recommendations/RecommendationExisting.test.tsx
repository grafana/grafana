import { render, screen, within } from 'test/test-utils';

import RecommendationExisting from './RecommendationExisting';

describe('RecommendationExisting', () => {
  it('opens the dropdown and switches the selected solution', async () => {
    const { user } = render(<RecommendationExisting />);

    const trigger = screen.getByRole('button');
    const initialLabel = within(trigger).getByRole('heading').textContent?.trim() ?? '';
    expect(initialLabel).not.toBe('');

    await user.click(trigger);

    expect(await screen.findByRole('menu')).toBeInTheDocument();
    const menuItems = screen.getAllByRole('menuitem');
    expect(menuItems.length).toBeGreaterThan(1);

    const nextItem = menuItems.find((item) => (item.textContent?.trim() ?? '') !== initialLabel);
    expect(nextItem).toBeDefined();

    const nextLabel = nextItem?.textContent?.trim() ?? '';
    expect(nextLabel).not.toBe('');

    await user.click(nextItem!);

    expect(within(trigger).getByRole('heading', { name: nextLabel })).toBeInTheDocument();
    expect(within(trigger).queryByRole('heading', { name: initialLabel })).not.toBeInTheDocument();
  });
});
