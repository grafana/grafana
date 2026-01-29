import { useEffect } from 'react';
import { render, screen, userEvent } from 'test/test-utils';

import { Stepper } from './Stepper';
import { StepperStateProvider, useStepperState } from './StepperState';
import { StepKey } from './types';

const renderWithProvider = (ui: React.ReactElement, initialStep?: StepKey) => {
  return render(<StepperStateProvider initialStep={initialStep}>{ui}</StepperStateProvider>);
};

describe('Stepper', () => {
  const user = userEvent.setup();

  it('should render all steps with correct numbers and names', () => {
    renderWithProvider(<Stepper />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    expect(screen.getByText(/notification resources/i)).toBeInTheDocument();
    expect(screen.getByText(/alert rules/i)).toBeInTheDocument();
    expect(screen.getByText(/review & import/i)).toBeInTheDocument();
  });

  it('should highlight the active step', () => {
    const TestComponent = () => {
      const { activeStep } = useStepperState();
      return (
        <div>
          <div data-testid="active-step">{activeStep}</div>
          <Stepper />
        </div>
      );
    };

    renderWithProvider(<TestComponent />, StepKey.Notifications);

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Notifications);

    const notificationsStep = screen.getByRole('button', { name: /notification resources/i });
    expect(notificationsStep).toBeInTheDocument();
    expect(notificationsStep).toBeEnabled();
  });

  it('should show completed step with check icon when step is completed without errors', () => {
    const TestComponent = () => {
      const { setStepCompleted, setVisitedStep } = useStepperState();
      useEffect(() => {
        setVisitedStep(StepKey.Notifications);
        setStepCompleted(StepKey.Notifications, true);
      }, [setStepCompleted, setVisitedStep]);
      return <Stepper />;
    };

    renderWithProvider(<TestComponent />, StepKey.Rules);

    // Check icon should be visible for completed step (Icon component renders SVG with aria-hidden)
    const notificationsButton = screen.getByRole('button', { name: /notification resources/i });
    const indicator = notificationsButton.querySelector('span');
    const svg = indicator?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    // When icon is shown, step number should not be shown
    expect(indicator).not.toHaveTextContent('1');
  });

  it('should show warning icon when step has errors', () => {
    const TestComponent = () => {
      const { setStepErrors, setVisitedStep } = useStepperState();
      useEffect(() => {
        setVisitedStep(StepKey.Notifications);
        setStepErrors(StepKey.Notifications, true);
      }, [setStepErrors, setVisitedStep]);
      return <Stepper />;
    };

    renderWithProvider(<TestComponent />, StepKey.Rules);

    const notificationsButton = screen.getByRole('button', { name: /notification resources/i });
    const indicator = notificationsButton.querySelector('span');
    const svg = indicator?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(indicator).not.toHaveTextContent('1');
  });

  it('should show skipped icon when step is skipped', () => {
    const TestComponent = () => {
      const { setStepSkipped, setVisitedStep } = useStepperState();
      useEffect(() => {
        setVisitedStep(StepKey.Notifications);
        setStepSkipped(StepKey.Notifications, true);
      }, [setStepSkipped, setVisitedStep]);
      return <Stepper />;
    };

    renderWithProvider(<TestComponent />, StepKey.Rules);

    const notificationsButton = screen.getByRole('button', { name: /notification resources/i });
    const indicator = notificationsButton.querySelector('span');
    const svg = indicator?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(indicator).not.toHaveTextContent('1');
  });

  it('should allow navigation to previous steps', async () => {
    const TestComponent = () => {
      const { activeStep, setActiveStep, setStepCompleted } = useStepperState();
      useEffect(() => {
        setStepCompleted(StepKey.Notifications, true);
        setActiveStep(StepKey.Rules);
      }, [setActiveStep, setStepCompleted]);
      return (
        <div>
          <div data-testid="active-step">{activeStep}</div>
          <Stepper />
        </div>
      );
    };

    renderWithProvider(<TestComponent />, StepKey.Rules);

    // Verify we start on Rules step
    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Rules);

    // Click on the first step (going backward)
    const notificationsButton = screen.getByRole('button', { name: /notification resources/i });
    await user.click(notificationsButton);

    // Active step should now be Notifications - verify via context
    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Notifications);
  });

  it('should block navigation to future steps when previous steps are not completed', () => {
    renderWithProvider(<Stepper />, StepKey.Notifications);

    const rulesButton = screen.getByRole('button', { name: /alert rules/i });
    expect(rulesButton).toBeDisabled();
  });

  it('should allow navigation to future steps when all previous steps are completed', async () => {
    const TestComponent = () => {
      const { activeStep, setStepCompleted, setVisitedStep } = useStepperState();
      useEffect(() => {
        setVisitedStep(StepKey.Notifications);
        setStepCompleted(StepKey.Notifications, true);
      }, [setStepCompleted, setVisitedStep]);
      return (
        <div>
          <div data-testid="active-step">{activeStep}</div>
          <Stepper />
        </div>
      );
    };

    renderWithProvider(<TestComponent />, StepKey.Notifications);

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Notifications);

    const rulesButton = screen.getByRole('button', { name: /alert rules/i });
    expect(rulesButton).toBeEnabled();

    await user.click(rulesButton);

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Rules);
  });

  it('should allow navigation to future steps when previous steps are skipped', async () => {
    const TestComponent = () => {
      const { activeStep, setStepSkipped, setVisitedStep } = useStepperState();
      useEffect(() => {
        setVisitedStep(StepKey.Notifications);
        setStepSkipped(StepKey.Notifications, true);
      }, [setStepSkipped, setVisitedStep]);
      return (
        <div>
          <div data-testid="active-step">{activeStep}</div>
          <Stepper />
        </div>
      );
    };

    renderWithProvider(<TestComponent />, StepKey.Notifications);

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Notifications);

    const rulesButton = screen.getByRole('button', { name: /alert rules/i });
    expect(rulesButton).toBeEnabled();

    await user.click(rulesButton);

    expect(screen.getByTestId('active-step')).toHaveTextContent(StepKey.Rules);
  });

  it('should mark current step as visited when navigating to another step', async () => {
    const TestComponent = () => {
      const { setStepCompleted } = useStepperState();
      useEffect(() => {
        setStepCompleted(StepKey.Notifications, true);
      }, [setStepCompleted]);
      return <Stepper />;
    };

    renderWithProvider(<TestComponent />, StepKey.Notifications);

    const notificationsButton = screen.getByRole('button', { name: /notification resources/i });
    const rulesButton = screen.getByRole('button', { name: /alert rules/i });

    await user.click(rulesButton);

    const indicator = notificationsButton.querySelector('span');
    const svg = indicator?.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(indicator).not.toHaveTextContent('1');
  });
});
