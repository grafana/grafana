/**
 * ⚠️ @TODO this will eventually be replaced with "@grafana/test-utils", consider helping out instead of adding things here!
 */
import { type RenderOptions, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getDefaultWrapper, store } from './provider';

import '@testing-library/jest-dom';

/**
 * Extended [@testing-library/react render](https://testing-library.com/docs/react-testing-library/api/#render)
 * method which wraps the passed element in all of the necessary Providers,
 * so it can render correctly in the context of the application
 */
const customRender = (ui: React.ReactNode, renderOptions: RenderOptions = {}) => {
  const user = userEvent.setup();
  const Providers = renderOptions.wrapper || getDefaultWrapper();

  return {
    renderResult: render(ui, { wrapper: Providers, ...renderOptions }),
    user,
    store,
  };
};

export * from '@testing-library/react';
export { customRender as render, userEvent };
