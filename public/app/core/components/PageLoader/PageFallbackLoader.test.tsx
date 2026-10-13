import { screen } from '@testing-library/react';
import { getWrapper, render } from 'test/test-utils';

import { AppChromeService } from '../AppChrome/AppChromeService';

import { PageFallbackLoader } from './PageFallbackLoader';

describe('PageFallbackLoader', () => {
  it('renders the active step', () => {
    render(<PageFallbackLoader />);

    expect(screen.getByTestId('page-fallback-loader')).toBeInTheDocument();
    expect(screen.getByText('Fetching data')).toBeInTheDocument();
  });

  it('clears the chrome default chromeless state on mount', () => {
    const chrome = new AppChromeService();
    expect(chrome.state.getValue().chromeless).toBe(true);

    const wrapper = getWrapper({ grafanaContext: { chrome } });
    render(<PageFallbackLoader />, { wrapper });

    expect(chrome.state.getValue().chromeless).toBeFalsy();
  });
});
