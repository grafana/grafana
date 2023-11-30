import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export async function addOperation(section: string, op: string) {
  const addOperationButton = screen.getByTitle('Add operation');
  expect(addOperationButton).toBeInTheDocument();
  await userEvent.click(addOperationButton);
  const sectionItem = await screen.findByTitle(section);
  expect(sectionItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(sectionItem.children[0], { pointerEventsCheck: 0 });
  const opItem = screen.getByTitle(op);
  expect(opItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  await userEvent.click(opItem, { pointerEventsCheck: 0 });
}
