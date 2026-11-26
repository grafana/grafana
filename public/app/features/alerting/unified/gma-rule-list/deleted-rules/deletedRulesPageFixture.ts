import { screen, userEvent, within } from 'test/test-utils';

/** Opens the Restore modal for the only listed rule and confirms it, once its "Deleted by" name has resolved. */
export async function confirmRestore(deletedByName: string) {
  await screen.findByText(deletedByName);
  await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
  const modal = await screen.findByRole('dialog');
  await userEvent.click(within(modal).getByRole('button', { name: 'Restore' }));
}
