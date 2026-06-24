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

function getScorePill(score: number) {
  return screen.getByText(`${score}%`);
}

describe('ActionabilityProgressBar', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('uses severity text on a tinted background in dark themes', () => {
    const actionability: ActionabilityScore = { score: 25, missing: ['summary', 'description'] };

    for (const themeId of ['dark', 'visual_refresh_dark']) {
      const { restoreTheme, theme, unmount } = renderWithTheme(themeId, actionability);
      const pill = getScorePill(25);
      const styles = window.getComputedStyle(pill);

      expect(styles.color).toBe(toComputedColor(theme.colors.error.text));
      expect(styles.backgroundColor).toBe(toComputedBackground(theme.colors.error.transparent));

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
