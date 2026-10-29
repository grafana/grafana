import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createTheme } from '@grafana/data';

import { getMermaidConfig } from '../../public/app/core/utils/mermaidConfig';
import { SandboxFrame, type SandboxFrameProps } from '../../public/app/plugins/panel/text/v2/SandboxFrame';

export { textSandboxPolicy, type TextSandboxState } from '../../public/app/plugins/panel/text/v2/sandboxPolicy';

export function mermaidConfig(mode: 'light' | 'dark' = 'dark') {
  return getMermaidConfig(createTheme({ colors: { mode } }));
}

export function renderSandbox(host: HTMLElement, props: SandboxFrameProps) {
  const root = createRoot(host);
  const update = (changes: Partial<SandboxFrameProps>) => {
    props = { ...props, ...changes };
    root.render(
      <StrictMode>
        <SandboxFrame {...props} />
      </StrictMode>
    );
  };
  update(props);
  return { update, unmount: () => root.unmount() };
}
