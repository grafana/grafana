import { useLayoutEffect } from 'react';

import type { SandboxFrameProps } from '../SandboxFrame';

// JSDOM cannot enforce CSP or load srcdoc. Browser tests exercise the real component.
export const SandboxFrame = jest.fn(function SandboxFrame({
  html,
  policy,
  globalCss,
  mermaid,
  onState,
}: SandboxFrameProps) {
  useLayoutEffect(() => {
    onState({ status: 'ready', resources: [] });
    return () => onState(undefined);
  }, [html, policy, globalCss, mermaid, onState]);
  return <div data-text-blocks dangerouslySetInnerHTML={{ __html: html }} />;
});
