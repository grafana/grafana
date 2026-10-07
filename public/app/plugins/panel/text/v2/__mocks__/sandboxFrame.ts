import type { mountTextSandbox as MountTextSandbox } from '../sandboxFrame';

const actual = jest.requireActual('../sandboxFrame');

export const getGlobalCss = actual.getGlobalCss;
export const textSandboxPolicy = actual.textSandboxPolicy;

// JSDOM has no CSP or srcdoc implementation. Browser tests exercise the real controller.
export const mountTextSandbox = jest.fn<ReturnType<typeof MountTextSandbox>, Parameters<typeof MountTextSandbox>>(
  (host, options) => {
    host.innerHTML = `<div data-text-blocks>${options.html}</div>`;
    options.onState({ status: 'ready' });
    return () => host.replaceChildren();
  }
);
