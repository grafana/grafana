import { Matcher, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { select } from 'react-select-event';
import { byRole } from 'testing-library-selector';

// Used to select an option or options from a Select in unit tests
export const selectOptionInTest = async (
  input: HTMLElement,
  optionOrOptions: string | RegExp | Array<string | RegExp>
) => await waitFor(() => select(input, optionOrOptions, { container: document.body }));

// Finds the parent of the Select so you can assert if it has a value
export const getSelectParent = (input: HTMLElement) =>
  input.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;

export const clickSelectOption = async (selectElement: HTMLElement, optionText: string): Promise<void> => {
  await userEvent.click(byRole('combobox').get(selectElement));
  await selectOptionInTest(selectElement, optionText);
};
export const clickSelectOptionMatch = async (selectElement: HTMLElement, optionText: Matcher): Promise<void> => {
  await userEvent.click(byRole('combobox').get(selectElement));
  await selectOptionInTest(selectElement, optionText as string);
};
