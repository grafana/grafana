import { act, fireEvent } from '@testing-library/react';

export const click = async (selector: () => HTMLElement) => act(() => fireEvent.click(selector()));
export const type = async (selector: () => HTMLInputElement, value: string) =>
  act(() => fireEvent.input(selector(), { target: { value } }));
export const clear = async (selector: () => HTMLInputElement) => type(selector, '');
