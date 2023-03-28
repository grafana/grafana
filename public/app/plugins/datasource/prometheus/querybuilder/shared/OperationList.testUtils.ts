import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

export async function addOperation(section: string, op: string) {
  const addOperationButton = screen.getByTitle('Add operation');
  expect(addOperationButton).toBeInTheDocument();
  await userEvent.click(addOperationButton);
  const sectionItem = screen.getByTitle(section);
  expect(sectionItem).toBeInTheDocument();
  // Weirdly the await userEvent.click doesn't work here, it reports the item has pointer-events: none. Don't see that
  // anywhere when debugging so not sure what style is it picking up.
  fireEvent.click(sectionItem.children[0]);
  const opItem = screen.getByTitle(op);
  expect(opItem).toBeInTheDocument();
  fireEvent.click(opItem);
}
