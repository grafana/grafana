import { type UserEvent } from '@testing-library/user-event';
import { within } from 'test/test-utils';

const CONTROL_ROLES = ['textbox', 'combobox', 'switch', 'button', 'radio', 'spinbutton', 'checkbox'];

/** Every interactive element under `container`, so a test can require each of them to have a name. */
export function getInteractiveControls(container: HTMLElement): HTMLElement[] {
  return CONTROL_ROLES.flatMap((role) => within(container).queryAllByRole(role));
}

/** The elements keyboard focus lands on, in order, while pressing Tab `presses` times from `start`. */
export async function tabSequence(user: UserEvent, start: HTMLElement, presses: number): Promise<Element[]> {
  start.focus();
  const visited: Element[] = [];
  for (let press = 0; press < presses; press++) {
    await user.tab();
    if (document.activeElement) {
      visited.push(document.activeElement);
    }
  }
  return visited;
}
