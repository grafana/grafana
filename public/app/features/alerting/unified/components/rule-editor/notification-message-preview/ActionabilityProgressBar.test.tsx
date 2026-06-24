import { render, screen } from '@testing-library/react';

import { getThemeById } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';
import { TestProvider } from 'test/helpers/TestProvider';

import { ActionabilityProgressBar } from './ActionabilityProgressBar';
import { type ActionabilityScore } from './computeActionabilityScore';

function renderWithTheme(themeId: string, actionability: ActionabilityScore) {
  const theme = getThemeById(themeId);
  const restoreTheme = mockThemeContext(theme);

  const view = render(
    <TestProvider>
      <ActionabilityProgressBar actionability={actionability} />
    </TestProvider>
  );

  return { ...view, restoreTheme, theme };
}

function getScoreText() {
  return screen.getByTestId('actionability-score-value');
}

describe('ActionabilityProgressBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
  { score: 35, severity: 'error' as const },
  { score: 50, severity: 'warning' as const },
  { score: 85, severity: 'success' as const },
])(
  'uses bold severity text without a pill background in dark themes for $severity scores',
  ({ score, severity }) => {
    const actionability: ActionabilityScore = { score, missing: ['summary'] };

    for (const themeId of ['dark', 'visual_refresh_dark']) {
      const { restoreTheme, theme, unmount } = renderWithTheme(themeId, actionability);
      const scoreText = getScoreText();
      const styles = window.getComputedStyle(scoreText);

      expect(styles.color).toBe(toComputedColor(theme.colors[severity].text));
      expect(styles.fontWeight).toBe(String(theme.typography.fontWeightBold));
      expect(styles.fontSize).toBe(toComputedFontSize(theme.typography.h5.fontSize));
      expect(styles.backgroundColor).not.toBe(toComputedBackground(theme.colors[severity].transparent));

      const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;
      expect(window.getComputedStyle(fill).backgroundColor).toBe(
        toComputedBackground(theme.colors[severity].main)
      );

      restoreTheme();
      unmount();
    }
  }
);

  it('renders actionability label and missing hints', () => {
    const { restoreTheme } = renderWithTheme('visual_refresh_dark', {
      score: 50,
      missing: ['runbook URL'],
    });

    expect(screen.getByText('Actionability')).toBeInTheDocument();
    expect(screen.getByText(/Still missing: runbook URL/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    restoreTheme();
  });
});

function toComputedColor(color: string) {
  const el = document.createElement('span');
  el.style.color = color;
  return window.getComputedStyle(el).color;
}

function toComputedBackground(color: string) {
  const el = document.createElement('span');
  el.style.backgroundColor = color;
  return window.getComputedStyle(el).backgroundColor;
}

function toComputedFontSize(fontSize: string) {
  const el = document.createElement('span');
  el.style.fontSize = fontSize;
  return window.getComputedStyle(el).fontSize;
}
