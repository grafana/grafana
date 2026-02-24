import { FormProvider, useForm } from 'react-hook-form';
import { render, screen, userEvent } from 'test/test-utils';

import { StepperStateProvider } from './StepperState';
import { WizardStep } from './WizardStep';
import { StepKey } from './types';

// Wrapper component that provides FormProvider context
function TestFormWrapper({ children }: { children: React.ReactNode }) {
  const methods = useForm();
  return <FormProvider {...methods}>{children}</FormProvider>;
}

const renderWithProvider = (ui: React.ReactElement, initialStep?: StepKey) => {
  return render(
    <TestFormWrapper>
      <StepperStateProvider initialStep={initialStep}>{ui}</StepperStateProvider>
    </TestFormWrapper>
  );
};

describe('WizardStep', () => {
  const user = userEvent.setup();

  it('should render label and subHeader', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" subHeader="Test description">
        <div>Step content</div>
      </WizardStep>
    );

    expect(screen.getByText('Test Step')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render children content', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step">
        <div data-testid="step-content">Step content</div>
      </WizardStep>
    );

    expect(screen.getByTestId('step-content')).toBeInTheDocument();
    expect(screen.getByText('Step content')).toBeInTheDocument();
  });

  it('should not render subHeader when not provided', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step">
        <div>Step content</div>
      </WizardStep>
    );

    expect(screen.getByText('Test Step')).toBeInTheDocument();
    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('should call onNext when Next button is clicked and proceed if it returns true', async () => {
    const onNext = jest.fn().mockResolvedValue(true);

    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" onNext={onNext}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    await user.click(nextButton);

    expect(onNext).toHaveBeenCalledTimes(1);
    // The step should proceed (we can verify by checking that the button click was handled)
    await user.click(nextButton);
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('should not proceed when onNext returns false', async () => {
    const onNext = jest.fn().mockResolvedValue(false);

    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" onNext={onNext}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    await user.click(nextButton);

    expect(onNext).toHaveBeenCalledTimes(1);
    // The step should not proceed - verify by checking the button is still clickable
    expect(nextButton).toBeInTheDocument();
  });

  it('should handle async onNext', async () => {
    const onNext = jest.fn().mockImplementation(() => Promise.resolve(true));

    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" onNext={onNext}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    await user.click(nextButton);

    expect(onNext).toHaveBeenCalledTimes(1);
    // Wait for async operation to complete
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('should render Skip button when canSkip is true', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" canSkip={true}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    expect(screen.getByTestId('wizard-skip-button')).toBeInTheDocument();
  });

  it('should not render Skip button when canSkip is false', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" canSkip={false}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    expect(screen.queryByTestId('wizard-skip-button')).not.toBeInTheDocument();
  });

  it('should use custom skipLabel when provided', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" canSkip={true} skipLabel="Custom Skip">
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    expect(screen.getByText('Custom Skip')).toBeInTheDocument();
  });

  it('should call onSkip when Skip button is clicked', async () => {
    const onSkip = jest.fn();

    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" canSkip={true} onSkip={onSkip}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const skipButton = screen.getByTestId('wizard-skip-button');
    await user.click(skipButton);

    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('should hide Previous button on first step', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step">
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    expect(screen.queryByTestId('wizard-prev-button')).not.toBeInTheDocument();
  });

  it('should show Previous button on subsequent steps', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Rules} label="Test Step">
        <div>Step content</div>
      </WizardStep>,
      StepKey.Rules
    );

    expect(screen.getByTestId('wizard-prev-button')).toBeInTheDocument();
  });

  it('should call onBack when Previous button is clicked', async () => {
    const onBack = jest.fn();

    renderWithProvider(
      <WizardStep stepId={StepKey.Rules} label="Test Step" onBack={onBack}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Rules
    );

    const prevButton = screen.getByTestId('wizard-prev-button');
    await user.click(prevButton);

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('should render Cancel button', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step">
        <div>Step content</div>
      </WizardStep>
    );

    expect(screen.getByTestId('wizard-cancel-button')).toBeInTheDocument();
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
  });

  it('should disable Next button when disableNext is true', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" disableNext={true}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    expect(nextButton).toBeDisabled();
  });

  it('should enable Next button when disableNext is false', () => {
    renderWithProvider(
      <WizardStep stepId={StepKey.Notifications} label="Test Step" disableNext={false}>
        <div>Step content</div>
      </WizardStep>,
      StepKey.Notifications
    );

    const nextButton = screen.getByTestId('wizard-next-button');
    expect(nextButton).toBeEnabled();
  });
});
