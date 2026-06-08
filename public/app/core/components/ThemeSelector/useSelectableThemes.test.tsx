import { act } from '@testing-library/react';
import { render, screen } from 'test/test-utils';

import { config } from '@grafana/runtime';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { useSelectableThemes } from './useSelectableThemes';

function TestThemes() {
  const themes = useSelectableThemes();
  return (
    <ul>
      {themes.map((theme) => (
        <li key={theme.id} data-testid={`theme-${theme.id}`}>
          {theme.id}
        </li>
      ))}
    </ul>
  );
}

const COLORBLIND_THEMES = ['deut_prot_dark', 'deut_prot_light', 'tritanopia_dark', 'tritanopia_light'];
const GRAFANACON_THEMES = ['desertbloom', 'gildedgrove', 'sapphiredusk', 'tron', 'gloom'];

describe('useSelectableThemes', () => {
  beforeEach(() => {
    setTestFlags({});
    config.featureToggles.grafanaconThemes = false;
  });

  afterEach(async () => {
    // Wrap in act() because setTestFlags fires OpenFeature events that trigger
    // React state updates while the component is still mounted.
    await act(async () => {
      setTestFlags({});
    });
    config.featureToggles.grafanaconThemes = false;
  });

  it('does not include colorblind or grafanacon themes when both toggles are off', () => {
    render(<TestThemes />);
    for (const id of [...COLORBLIND_THEMES, ...GRAFANACON_THEMES]) {
      expect(screen.queryByTestId(`theme-${id}`)).not.toBeInTheDocument();
    }
  });

  it('includes the four colorblind themes when colorblindThemes is enabled via OpenFeature', () => {
    setTestFlags({ colorblindThemes: true });
    render(<TestThemes />);
    for (const id of COLORBLIND_THEMES) {
      expect(screen.getByTestId(`theme-${id}`)).toBeInTheDocument();
    }
    for (const id of GRAFANACON_THEMES) {
      expect(screen.queryByTestId(`theme-${id}`)).not.toBeInTheDocument();
    }
  });

  it('includes the five grafanacon themes when grafanaconThemes (legacy) is enabled', () => {
    config.featureToggles.grafanaconThemes = true;
    render(<TestThemes />);
    for (const id of GRAFANACON_THEMES) {
      expect(screen.getByTestId(`theme-${id}`)).toBeInTheDocument();
    }
    for (const id of COLORBLIND_THEMES) {
      expect(screen.queryByTestId(`theme-${id}`)).not.toBeInTheDocument();
    }
  });

  it('includes both sets when both toggles are enabled', () => {
    setTestFlags({ colorblindThemes: true });
    config.featureToggles.grafanaconThemes = true;
    render(<TestThemes />);
    for (const id of [...COLORBLIND_THEMES, ...GRAFANACON_THEMES]) {
      expect(screen.getByTestId(`theme-${id}`)).toBeInTheDocument();
    }
  });
});
