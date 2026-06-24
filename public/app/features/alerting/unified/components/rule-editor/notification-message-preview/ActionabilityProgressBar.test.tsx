import { render, screen } from '@testing-library/react';

import { getThemeById } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';
import { TestProvider } from 'test/helpers/TestProvider';

import { ActionabilityProgressBar } from './ActionabilityProgressBar';
import { type ActionabilityScore } from './computeActionabilityScore';

const SCORE_COLORS = {
  error: '#FF5286',
  warning: '#FFB357',
  success: '#73BF69',
} as const;

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

describe('ActionabilityProgressBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    { score: 35, severity: 'error' as const },
    { score: 50, severity: 'warning' as const },
    { score: 85, severity: 'success' as const },
  ])('uses hardcoded severity colors visible in all themes for $severity scores', ({ score, severity }) => {
    const actionability: ActionabilityScore = { score, missing: ['summary'] };

    for (const themeId of ['dark', 'visual_refresh_dark', 'light', 'visual_refresh']) {
      const { restoreTheme, unmount } = renderWithTheme(themeId, actionability);
      const scoreText = getScoreText();
      const styles = window.getComputedStyle(scoreText);

      expect(styles.color).toBe(toComputedColor(SCORE_COLORS[severity]));
      expect(styles.fontWeight).toBe('700');
      expect(styles.fontSize).toBe('18px');
      expect(styles.display).toBe('block');
      expect(scoreText.textContent).toBe(`${score}%`);

      const fill = screen.getByRole('progressbar').firstElementChild as HTMLElement;
      expect(window.getComputedStyle(fill).backgroundColor).toBe(toComputedBackground(SCORE_COLORS[severity]));

      restoreTheme();
      unmount();
    }
  });

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
