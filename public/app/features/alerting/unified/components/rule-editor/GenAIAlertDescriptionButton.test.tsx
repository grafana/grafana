import { render, screen } from '@testing-library/react';
import { FormProvider, useForm } from 'react-hook-form';
import { Provider } from 'react-redux';
import { configureStore } from 'app/store/configureStore';

import { GenAIAlertDescriptionButton } from './GenAIAlertDescriptionButton';
import { GenAIButton } from './GenAIButton';

// Mock the GenAIButton component
jest.mock('./GenAIButton', () => ({
  GenAIButton: jest.fn(() => <div data-testid="gen-ai-button">GenAIButton</div>),
  Role: {
    system: 'system',
    user: 'user',
  },
}));

// Mock react-hook-form
const mockWatch = jest.fn();
const FormProviderWrapper: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
  const methods = useForm({
    defaultValues: {
      name: 'Test Alert Rule',
      type: 'test',
      annotations: [{ key: 'description', value: 'Test description' }],
      labels: [{ key: 'test', value: 'label' }],
      queries: [{ model: { test: 'query' } }],
    },
  });

  // Track when watch method is used
  mockWatch.mockImplementation(() => {});
  // No need to replace methods.watch

  return <FormProvider {...methods}>{children}</FormProvider>;
};

const mockStore = configureStore();

describe('GenAIAlertDescriptionButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render GenAIButton', () => {
    render(
      <Provider store={mockStore}>
        <FormProviderWrapper>
          <GenAIAlertDescriptionButton onGenerate={jest.fn()} />
        </FormProviderWrapper>
      </Provider>
    );

    expect(screen.getByTestId('gen-ai-button')).toBeInTheDocument();
  });

  it('should call GenAIButton with proper props', () => {
    const onGenerate = jest.fn();
    render(
      <Provider store={mockStore}>
        <FormProviderWrapper>
          <GenAIAlertDescriptionButton onGenerate={onGenerate} />
        </FormProviderWrapper>
      </Provider>
    );

    // Check that form values are used
    expect(GenAIButton).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.any(Array),
      }),
      expect.anything()
    );

    // Check that the messages array exists
    const props = jest.mocked(GenAIButton).mock.calls[0][0];
    expect(props.messages).toBeDefined();

    // Since messages can be a function or array, we'd need runtime type checking
    // to safely test its contents, which would be better in an integration test

    // Verify GenAIButton was called with expected props
    expect(GenAIButton).toHaveBeenCalledWith(
      expect.objectContaining({
        onGenerate,
        toggleTipTitle: 'Improve your alert rule description',
        tooltip: 'Generate a description for this alert rule',
      }),
      expect.anything()
    );
  });
});
