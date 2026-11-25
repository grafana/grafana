import { screen } from '@testing-library/react';
import { lazy, type ReactNode } from 'react';
import { render } from 'test/test-utils';

import { type ChatContextItem } from '@grafana/assistant';
import { usePluginComponent } from '@grafana/runtime';

import { DashboardLandingPrompt, STANDALONE_PROMPT_COMPONENT_ID } from './DashboardLandingPrompt';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  usePluginComponent: jest.fn(),
}));

const usePluginComponentMock = jest.mocked(usePluginComponent);

interface CapturedPromptProps {
  onSubmit: (prompt: string, contextItems: ChatContextItem[]) => void | Promise<void>;
  placeholder?: string;
  hideModeSelector?: boolean;
  mode?: string;
  hostContextItems?: ChatContextItem[];
  onHostContextItemRemove?: (id: string) => void;
  renderHostActions?: () => ReactNode;
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
    const Prompt = () => <textarea aria-label="Describe your dashboard" />;
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={jest.fn()} />);

    expect(screen.getByRole('textbox', { name: 'Describe your dashboard' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Loading')).not.toBeInTheDocument();
  });

  it('configures dashboard planning with the default Assistant context picker', () => {
    const received: CapturedPromptProps[] = [];
    const onSubmit = jest.fn();
    const Prompt = (props: CapturedPromptProps) => {
      received.push(props);
      return (
        <textarea aria-label="Describe your dashboard. This will open the assistant chat and start a conversation." />
      );
    };
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    const hostContextItems: ChatContextItem[] = [
      { node: { id: 'template-red', name: 'Dashboard Template: RED metrics', navigable: false }, occurrences: [] },
    ];
    const onHostContextItemRemove = jest.fn();
    const renderHostActions = () => null;

    render(
      <DashboardLandingPrompt
        onSubmit={onSubmit}
        hostContextItems={hostContextItems}
        onHostContextItemRemove={onHostContextItemRemove}
        renderHostActions={renderHostActions}
      />
    );

    expect(STANDALONE_PROMPT_COMPONENT_ID).toBe('grafana-assistant-app/standalone-prompt/v1');
    expect(usePluginComponentMock).toHaveBeenCalledWith(STANDALONE_PROMPT_COMPONENT_ID);
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      onSubmit: expect.any(Function),
      placeholder: 'Describe your dashboard. This will open the assistant chat and start a conversation.',
      hideModeSelector: true,
      mode: 'dashboarding',
      hostContextItems,
      onHostContextItemRemove,
      renderHostActions,
    });
    received[0].onSubmit('monitor checkout', []);
    expect(onSubmit).toHaveBeenCalledWith('monitor checkout', []);
  });

  it('hands a refused send back to the plugin, so it keeps the prompt', async () => {
    const received: CapturedPromptProps[] = [];
    const Prompt = (props: CapturedPromptProps) => {
      received.push(props);
      return null;
    };
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);

    render(<DashboardLandingPrompt onSubmit={() => Promise.reject(new Error('Could not reach the Assistant'))} />);

    await expect(received[0].onSubmit('monitor checkout', [])).rejects.toThrow('Could not reach the Assistant');
  });

  it('keeps a refused send from going unhandled when an older plugin drops the promise', async () => {
    const received: CapturedPromptProps[] = [];
    const Prompt = (props: CapturedPromptProps) => {
      received.push(props);
      return null;
    };
    usePluginComponentMock.mockReturnValue({
      component: Prompt,
      isLoading: false,
    } as unknown as ReturnType<typeof usePluginComponent>);
    const onSubmit = jest.fn().mockRejectedValue(new Error('Could not reach the Assistant'));

    render(<DashboardLandingPrompt onSubmit={onSubmit} />);

    // An older plugin calls onSubmit and ignores what it returns.
    received[0].onSubmit('monitor checkout', []);
    // jest-setup fails the run on an unhandled rejection; give one the chance to surface.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onSubmit).toHaveBeenCalledWith('monitor checkout', []);
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
