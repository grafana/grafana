import './sandboxNoEval';

import { merge } from 'lodash';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { createTheme, ThemeContext, type GrafanaTheme2 } from '@grafana/data';
import { IconSourceContext, MarkdownAdmonitions } from '@grafana/ui/internal';

import check from '../../../../../img/icons/unicons/check.svg';
import error from '../../../../../img/icons/unicons/exclamation-circle.svg';
import warning from '../../../../../img/icons/unicons/exclamation-triangle.svg';
import info from '../../../../../img/icons/unicons/info-circle.svg';

import type { RenderCommand } from './sandboxProtocol';

export type RenderAdmonitions = (command: RenderCommand, container: HTMLElement) => () => void;

export const renderAdmonitions: RenderAdmonitions = (command, container) => {
  const { admonitions } = command;
  if (!admonitions) {
    return () => {};
  }
  const serializedTheme: GrafanaTheme2 = JSON.parse(admonitions.theme);
  const { spacing, ...snapshot } = serializedTheme;
  // Restore theme functions while retaining the host's custom colors, typography and feature flags.
  const theme = merge(
    createTheme({
      colors: snapshot.colors,
      spacing,
      typography: {
        fontSize: snapshot.typography.fontSize,
        htmlFontSize: snapshot.typography.htmlFontSize,
      },
    }),
    snapshot
  );
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  flushSync(() =>
    root.render(
      <ThemeContext.Provider value={theme}>
        <IconSourceContext.Provider
          value={{ check, 'exclamation-circle': error, 'exclamation-triangle': warning, 'info-circle': info }}
        >
          <MarkdownAdmonitions container={container} titles={admonitions.titles} />
        </IconSourceContext.Provider>
      </ThemeContext.Provider>
    )
  );
  return () => {
    root.unmount();
    host.remove();
  };
};

const bootstrap = document.currentScript;
if (bootstrap && 'registerAdmonitions' in bootstrap && typeof bootstrap.registerAdmonitions === 'function') {
  bootstrap.registerAdmonitions(renderAdmonitions);
}
