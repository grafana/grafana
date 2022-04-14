import React from 'react';
import { Step, StepStatus } from './Step';
import { render, screen, fireEvent } from '@testing-library/react';
import { Icon } from '@grafana/ui';

jest.mock('@grafana/ui', () => ({
  ...jest.requireActual('@grafana/ui'),
  Icon: jest.fn(() => <div data-testid="icon" />),
}));

describe('Step::', () => {
  it('renders step header correctly with title and number', () => {
    render(
      <Step title="Test title" number={2} onClick={() => {}}>
        Test content
      </Step>
    );

    expect(screen.getByTestId('step-header').querySelectorAll('div')[0]).toHaveTextContent('2');
    expect(screen.getByTestId('step-header').querySelectorAll('div')[1]).toHaveTextContent('Test title');
  });

  it('renders step header correctly without title and number', () => {
    render(<Step onClick={() => {}}>Test content</Step>);

    expect(screen.getByTestId('step-header').querySelectorAll('div')[0]).toHaveTextContent('');
    expect(screen.getByTestId('step-header').querySelectorAll('div')[1]).not.toHaveTextContent('Test title');
  });

  it('renders checkmark when step is done', () => {
    render(
      <Step status={StepStatus.done} onClick={() => {}}>
        Test content
      </Step>
    );

    expect(Icon).toHaveBeenCalledWith(expect.objectContaining({ name: 'check' }), expect.anything());
  });
  it('renders step content correctly', () => {
    const { container } = render(<Step onClick={() => {}}>Test content</Step>);

    expect(container.querySelectorAll('div')[6]).toHaveTextContent('Test content');
  });
  it('calls step action', () => {
    const action = jest.fn();
    render(<Step onClick={action}>Test content</Step>);
    const header = screen.getByTestId('step-header');

    fireEvent.click(header);
    expect(action).toHaveBeenCalled();
  });
});
