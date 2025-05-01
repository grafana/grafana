import { E2ESelectors } from '@grafana/e2e-selectors';

export const SharedComponents = {
  buttons: {
    primary: 'data-testid primary button',
    secondary: 'data-testid secondary button',
    cancel: 'data-testid cancel button',
    close: 'data-testid close button',
  },
  alerts: {
    container: 'data-testid alert container',
    title: 'data-testid alert title',
    message: 'data-testid alert message',
    error: {
      container: 'data-testid error alert container',
      title: 'data-testid error alert title',
      message: 'data-testid error alert message',
    },
    warning: {
      container: 'data-testid warning alert container',
      title: 'data-testid warning alert title',
      message: 'data-testid warning alert message',
    },
    success: {
      container: 'data-testid success alert container',
      title: 'data-testid success alert title',
      message: 'data-testid success alert message',
    },
  },
  modals: {
    container: 'data-testid modal container',
    title: 'data-testid modal title',
    content: 'data-testid modal content',
    footer: 'data-testid modal footer',
  },
  forms: {
    input: (name: string) => `data-testid form input ${name}`,
    select: (name: string) => `data-testid form select ${name}`,
    checkbox: (name: string) => `data-testid form checkbox ${name}`,
    radio: (name: string) => `data-testid form radio ${name}`,
    submit: 'data-testid form submit button',
    cancel: 'data-testid form cancel button',
  },
  loading: {
    spinner: 'data-testid loading spinner',
    progress: 'data-testid loading progress',
  },
};

export const selectors: { components: E2ESelectors<typeof SharedComponents> } = {
  components: SharedComponents,
};
