import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createTheme, ThemeContext } from '@grafana/data';

import { TableWarningContent, TableWarnings } from './TableWarnings';

it.each(['light', 'dark'] as const)('groups warnings in a compact warning surface in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  const { container } = render(
    <ThemeContext.Provider value={theme}>
      <TableWarningContent
        warnings={[
          { id: 'size', message: 'Content is too long.' },
          { id: 'other', message: 'Another warning.' },
        ]}
      />
    </ThemeContext.Provider>
  );
  expect(container.firstElementChild).toHaveStyle({
    backgroundColor: theme.colors.warning.subtleBackground,
    color: theme.colors.text.primary,
    padding: theme.spacing(1),
  });
  expect(screen.getByTestId('icon-exclamation-triangle')).toHaveStyle({ color: theme.colors.warning.text });
  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Content is too long.',
    'Another warning.',
  ]);
});

it.each(['light', 'dark'] as const)('uses the warning color in the header corner in %s mode', (mode) => {
  const theme = createTheme({ colors: { mode } });
  render(
    <ThemeContext.Provider value={theme}>
      <TableWarnings scope="field" alignRight warnings={[{ id: 'size', message: 'Content is too long.' }]} />
    </ThemeContext.Provider>
  );
  expect(screen.getByRole('button', { name: 'Field warnings' })).toHaveStyle({
    background: `linear-gradient(to top right, transparent 62.5%, ${theme.colors.warning.main} 50%)`,
    right: theme.spacing(0.25),
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
