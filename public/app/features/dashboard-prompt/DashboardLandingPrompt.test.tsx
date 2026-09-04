import { screen } from '@testing-library/react';
import { lazy } from 'react';
import { render } from 'test/test-utils';

import { usePluginComponent } from '@grafana/runtime';

import { DashboardLandingPrompt, STANDALONE_PROMPT_COMPONENT_ID } from './DashboardLandingPrompt';
import { type DashboardLandingPromptSelection } from './types';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

interface CapturedPromptProps {
  onSubmit: (prompt: string, selection: DashboardLandingPromptSelection[]) => void;
  placeholder?: string;
  includeContextSections?: readonly string[];
  hideModeSelector?: boolean;
  mode?: string;
}

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

  it('configures the plugin prompt for dashboard planning', () => {
    const received: CapturedPromptProps[] = [];
    const onSubmit = jest.fn();
    const Prompt = (props: CapturedPromptProps) => {
      received.push(props);
      return (
        <textarea aria-label="Describe your dashboard to the assistant. This will open the assistant chat and start a conversation." />
      );
    };
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={onSubmit} />);

    expect(STANDALONE_PROMPT_COMPONENT_ID).toBe('grafana-assistant-app/standalone-prompt/v1');
    expect(usePluginComponentMock).toHaveBeenCalledWith(STANDALONE_PROMPT_COMPONENT_ID);
    expect(received).toHaveLength(1);
    expect(received[0].onSubmit).toBe(onSubmit);
    expect(received[0].placeholder).toBe(
      'Describe your dashboard to the assistant. This will open the assistant chat and start a conversation.'
    );
    expect(received[0].includeContextSections).toEqual(['datasources', 'dashboards']);
    expect(received[0].hideModeSelector).toBe(true);
    expect(received[0].mode).toBe('dashboarding');
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
