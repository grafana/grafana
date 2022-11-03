import { waitFor } from '@testing-library/react';
import { select } from 'react-select-event';

// Used to select an option or options from a Select in unit tests
export const selectOptionInTest = async (
  input: HTMLElement,
  optionOrOptions: string | RegExp | Array<string | RegExp>
) => await waitFor(() => select(input, optionOrOptions, { container: document.body }));

// Finds the parent of the Select so you can assert if it has a value
export const getSelectParent = (input: HTMLElement) =>
  input.parentElement?.parentElement?.parentElement?.parentElement?.parentElement;
