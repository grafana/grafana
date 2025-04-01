import { render, screen } from 'test/test-utils';

import RuleViewer from './RuleViewer';
import { stringifyErrorLike } from './utils/misc';

describe('Rule Viewer page', () => {
  it('should throw an error if rule ID cannot be decoded', () => {
    // check console errors
    jest.spyOn(console, 'error').mockImplementation((error) => {
      expect(stringifyErrorLike(error)).toContain('Error: Rule ID is required');
    });

    render(<RuleViewer />);
    expect(screen.getByText(/Error: Rule ID is required/i)).toBeInTheDocument();
  });
});
