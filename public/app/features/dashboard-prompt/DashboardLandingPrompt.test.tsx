import { screen } from '@testing-library/react';
import { lazy } from 'react';
import { render } from 'test/test-utils';

import { usePluginComponent } from '@grafana/runtime';

import { DashboardLandingPrompt } from './DashboardLandingPrompt';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

describe('DashboardLandingPrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a loader while the plugin is loading', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: true,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={jest.fn()} />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('shows the loading slot while the plugin prompt suspends', () => {
    const Prompt = lazy(() => new Promise<{ default: () => null }>(() => {}));
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={jest.fn()} />);

    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
  });

  it('renders the plugin prompt once it is available', () => {
    const Prompt = () => <textarea aria-label="Describe your dashboard to the assistant" />;
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={jest.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Describe your dashboard to the assistant' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  it('renders nothing when the plugin prompt is unavailable', () => {
    usePluginComponentMock.mockReturnValue({
      component: null,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const { container } = render(<DashboardLandingPrompt onSubmit={jest.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });
});
