import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, ThemeContext } from '@grafana/data';

import { TableWarnings } from './TableWarnings';

it.each(['light', 'dark'] as const)('uses the warning color and offsets from existing tooltips in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  render(
    <ThemeContext.Provider value={theme}>
      <TableWarnings scope="cell" alignRight offset warnings={[{ id: 'size', message: 'Content is too long.' }]} />
    </ThemeContext.Provider>
  );
  expect(screen.getByRole('button', { name: 'Cell warnings' })).toHaveStyle({
    background: `linear-gradient(to top right, transparent 62.5%, ${theme.colors.warning.main} 50%)`,
    right: theme.spacing(2.25),
  });
});

it('explains a single warning on keyboard focus and stops click propagation', async () => {
  const user = userEvent.setup();
  const onClick = jest.fn();
  render(
    <div onClick={onClick}>
      <TableWarnings scope="cell" warnings={[{ id: 'size', message: 'Content is too long.' }]} />
    </div>
  );
  await user.tab();
  expect(screen.getByRole('button', { name: 'Cell warnings' })).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent('Content is too long.');
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Cell warnings' }));
  expect(onClick).not.toHaveBeenCalled();
});

it('lists multiple warnings in supplied order and removes the marker when cleared', async () => {
  const user = userEvent.setup();
  const { rerender } = render(
    <TableWarnings
      scope="field"
      warnings={[
        { id: 'wrapping', message: 'Wrapping is disabled.' },
        { id: 'other', message: 'Another field warning.' },
      ]}
    />
  );
  await user.hover(screen.getByRole('button', { name: 'Field warnings' }));
  const list = within(await screen.findByRole('tooltip')).getByRole('list');
  expect(
    within(list)
      .getAllByRole('listitem')
      .map((item) => item.textContent)
  ).toEqual(['Wrapping is disabled.', 'Another field warning.']);
  rerender(<TableWarnings scope="field" warnings={[]} />);
  expect(screen.queryByRole('button', { name: 'Field warnings' })).not.toBeInTheDocument();
});
