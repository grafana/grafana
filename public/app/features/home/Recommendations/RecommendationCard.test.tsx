import { render, screen } from 'test/test-utils';

import { createTheme, ThemeContext } from '@grafana/data';

import { RecommendationCard } from './RecommendationCard';
import { type RecommendationItem } from './types';

const recommendation: RecommendationItem = {
  id: 'application-observability',
  title: 'Explore your service map',
  icon: 'application-observability',
  color: 'green',
  context: 'Built automatically from your telemetry',
  description: 'Turn OpenTelemetry data into RED metrics, service maps, and correlated traces automatically.',
  action: 'Enable Application Observability',
  href: '/plugins/grafana-app-observability-app/',
};

function renderCard(theme: ReturnType<typeof createTheme>) {
  return render(
    <ThemeContext.Provider value={theme}>
      <RecommendationCard recommendation={recommendation} startingState="metrics_only" />
    </ThemeContext.Provider>
  );
}

describe('RecommendationCard', () => {
  it('resolves the icon color from the palette name for the theme rendered', () => {
    const dark = createTheme({ colors: { mode: 'dark' } });
    const light = createTheme({ colors: { mode: 'light' } });
    const { rerender } = renderCard(dark);

    expect(screen.getByTestId('icon-application-observability')).toHaveStyle({
      color: dark.visualization.getColorByName('green'),
    });

    rerender(
      <ThemeContext.Provider value={light}>
        <RecommendationCard recommendation={recommendation} startingState="metrics_only" />
      </ThemeContext.Provider>
    );

    expect(screen.getByTestId('icon-application-observability')).toHaveStyle({
      color: light.visualization.getColorByName('green'),
    });
  });
});
