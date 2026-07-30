import { render, screen } from 'test/test-utils';

import RuleViewer from './RuleViewer';

describe('Rule Viewer page', () => {
  it('should throw an error if rule ID cannot be decoded', () => {
    // React reports the boundary-caught error over three console.error calls, and the last one is a
    // component stack that does not mention the error message. Assertions must therefore live in the
    // test body, not in the mock implementation — an expect() that throws inside React's error
    // logging path escapes as an uncaught exception and gets attributed to whichever test is running
    // when it surfaces.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<RuleViewer />);

    expect(screen.getByText(/Error: Rule ID is required/i)).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('Rule ID is required') })
    );

    consoleError.mockRestore();
  });
});
