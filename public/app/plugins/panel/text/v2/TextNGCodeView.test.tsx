import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';

import { CodeLanguage } from '../panelcfg.gen';

import { TextNGCodeView } from './TextNGCodeView';

// Kept in sync with the stub below, which paints it the way CodeMirror's own theme does.
const CODE_MIRROR_BACKGROUND = 'rgb(1, 2, 3)';

// The real editor lazily loads the CodeMirror bundle. The stub renders both what
// it shows while that is pending and a `.cm-editor` carrying a single-class
// background like the real theme, so styles that outrank it are exercised for real.
jest.mock('@grafana/ui/unstable', () => {
  const { css, cx } = require('@emotion/css');
  const themeBackground = css({ backgroundColor: 'rgb(1, 2, 3)' });

  return {
    __esModule: true,
    CodeMirrorEditor: ({ loadingFallback }: { loadingFallback: ReactNode }) => (
      <div className={cx('cm-editor', themeBackground)} data-testid="cm-editor">
        {loadingFallback}
      </div>
    ),
  };
});

const renderCodeView = (transparent?: boolean) =>
  render(
    <TextNGCodeView
      content="const a = 1;"
      language={CodeLanguage.Typescript}
      showLineNumbers={false}
      transparent={transparent}
    />
  );

describe('TextNGCodeView', () => {
  it('keeps the editor background for a regular panel', () => {
    renderCodeView(false);

    expect(screen.getByTestId('cm-editor')).toHaveStyle({ backgroundColor: CODE_MIRROR_BACKGROUND });
    expect(screen.getByText('const a = 1;')).not.toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('drops the editor background when the panel is transparent', () => {
    renderCodeView(true);

    expect(screen.getByTestId('cm-editor')).toHaveStyle({ backgroundColor: 'transparent' });
  });

  it('drops the loading fallback background when the panel is transparent', () => {
    renderCodeView(true);

    expect(screen.getByText('const a = 1;')).toHaveStyle({ backgroundColor: 'transparent' });
  });
});
