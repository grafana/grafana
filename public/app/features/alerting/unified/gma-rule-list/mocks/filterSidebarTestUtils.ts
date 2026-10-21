import { type UserEvent } from '@testing-library/user-event';
import { within } from 'test/test-utils';

const CONTROL_ROLES = ['textbox', 'combobox', 'switch', 'button', 'radio', 'spinbutton', 'checkbox'];

export function getInteractiveControls(container: HTMLElement): HTMLElement[] {
  return CONTROL_ROLES.flatMap((role) => within(container).queryAllByRole(role));
}

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
