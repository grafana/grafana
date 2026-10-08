import { useLayoutEffect } from 'react';

import type { SandboxFrameProps } from '../SandboxFrame';

// JSDOM cannot enforce CSP or load srcdoc. Browser tests exercise the real component.
export const SandboxFrame = jest.fn(function SandboxFrame({ html, onState }: SandboxFrameProps) {
  useLayoutEffect(() => {
    onState({ status: 'ready' });
  }, [onState]);
  return <div data-text-blocks dangerouslySetInnerHTML={{ __html: html }} />;
});
