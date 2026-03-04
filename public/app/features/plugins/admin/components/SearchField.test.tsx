import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';

import { SearchField } from './SearchField';

describe('SearchField', () => {
  const originalToggles = { ...config.featureToggles };

  beforeEach(() => {
    config.featureToggles = { ...originalToggles };
  });

  afterAll(() => {
    config.featureToggles = originalToggles;
  });

  it('renders without assistant controls when isAssistantAvailable is false', () => {
    config.featureToggles.pluginSearchAssistant = true;
    render(<SearchField onSearch={jest.fn()} isAssistantAvailable={false} />);

    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('More search options')).not.toBeInTheDocument();
  });

  it('renders without assistant controls when feature toggle is off', () => {
    config.featureToggles.pluginSearchAssistant = false;
    render(<SearchField onSearch={jest.fn()} isAssistantAvailable={true} />);

    expect(screen.queryByLabelText('Search')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('More search options')).not.toBeInTheDocument();
  });

  it('renders with Search button and dropdown when assistant is available', () => {
    config.featureToggles.pluginSearchAssistant = true;
    render(<SearchField onSearch={jest.fn()} onAssistant={jest.fn()} isAssistantAvailable={true} />);

    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByLabelText('More search options')).toBeInTheDocument();
  });

  it('shows Shift+Enter hint in placeholder when assistant is available', () => {
    config.featureToggles.pluginSearchAssistant = true;
    render(<SearchField onSearch={jest.fn()} onAssistant={jest.fn()} isAssistantAvailable={true} />);

    expect(screen.getByPlaceholderText(/\(Enter\).*\(Shift\+Enter\)/)).toBeInTheDocument();
  });

  it('calls onSearch when Enter is pressed', async () => {
    const onSearch = jest.fn();
    render(<SearchField onSearch={onSearch} />);

    const input = screen.getByPlaceholderText('Search Grafana plugins');
    await userEvent.type(input, 'kubernetes{Enter}');

    expect(onSearch).toHaveBeenCalledWith('kubernetes');
  });

  it('calls onAssistant when Shift+Enter is pressed', async () => {
    config.featureToggles.pluginSearchAssistant = true;
    const onAssistant = jest.fn();
    render(<SearchField onSearch={jest.fn()} onAssistant={onAssistant} isAssistantAvailable={true} />);

    const input = screen.getByPlaceholderText(/\(Enter\).*\(Shift\+Enter\)/);
    await userEvent.type(input, 'kubernetes');
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onAssistant).toHaveBeenCalledWith('kubernetes');
  });

  it('calls onSearch when Search button is clicked', async () => {
    config.featureToggles.pluginSearchAssistant = true;
    const onSearch = jest.fn();
    render(<SearchField onSearch={onSearch} onAssistant={jest.fn()} isAssistantAvailable={true} />);

    const input = screen.getByPlaceholderText(/\(Enter\).*\(Shift\+Enter\)/);
    await userEvent.type(input, 'kubernetes');
    await userEvent.click(screen.getByLabelText('Search'));

    expect(onSearch).toHaveBeenCalledWith('kubernetes');
  });

  it('opens dropdown and calls onAssistant when Ask Assistant is clicked', async () => {
    config.featureToggles.pluginSearchAssistant = true;
    const onAssistant = jest.fn();
    render(<SearchField onSearch={jest.fn()} onAssistant={onAssistant} isAssistantAvailable={true} />);

    await userEvent.click(screen.getByLabelText('More search options'));
    await userEvent.click(screen.getByText('Ask Assistant'));

    expect(onAssistant).toHaveBeenCalled();
  });

  it('opens dropdown and calls onGetStarted when Help me get started is clicked', async () => {
    config.featureToggles.pluginSearchAssistant = true;
    const onGetStarted = jest.fn();
    render(<SearchField onSearch={jest.fn()} onAssistant={jest.fn()} onGetStarted={onGetStarted} isAssistantAvailable={true} />);

    await userEvent.click(screen.getByLabelText('More search options'));
    await userEvent.click(screen.getByText('Help me get started'));

    expect(onGetStarted).toHaveBeenCalled();
  });

  it('clears input when Clear button is clicked', async () => {
    const onSearch = jest.fn();
    render(<SearchField value="kubernetes" onSearch={onSearch} />);

    const clearButton = screen.getByText('Clear');
    await userEvent.click(clearButton);

    expect(screen.getByPlaceholderText('Search Grafana plugins')).toHaveValue('');
    expect(onSearch).toHaveBeenCalledWith('');
  });
});
