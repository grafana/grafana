import { render, screen } from '@testing-library/react';
import { type ComponentType } from 'react';

import {
  NotificationMessagePreviewComponent,
  type NotificationMessagePreviewProps,
  addNotificationMessagePreview,
} from './addNotificationMessagePreview';

// Component that throws an error for testing
const ThrowingComponent: ComponentType<NotificationMessagePreviewProps> = () => {
  throw new Error('Test error from preview component');
};

// Component that renders normally
const WorkingComponent: ComponentType<NotificationMessagePreviewProps> = () => {
  return <div>Notification message preview</div>;
};

describe('NotificationMessagePreviewComponent Error Boundary', () => {
  beforeEach(() => {
    addNotificationMessagePreview(null);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render null when no component is registered', () => {
    const { container } = render(<NotificationMessagePreviewComponent />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render the registered component when it works correctly', () => {
    addNotificationMessagePreview(WorkingComponent);
    render(<NotificationMessagePreviewComponent />);
    expect(screen.getByText('Notification message preview')).toBeInTheDocument();
  });

  it('should gracefully handle errors from registered components with error boundary', () => {
    addNotificationMessagePreview(ThrowingComponent);

    // Render the component, it should not crash the page
    render(<NotificationMessagePreviewComponent />);

    expect(screen.getByText('Notification message preview failed to load')).toBeInTheDocument();
    // Check for error alert role instead of direct DOM access
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
