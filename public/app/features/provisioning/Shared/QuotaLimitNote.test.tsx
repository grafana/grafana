import { Fragment, type PropsWithChildren } from 'react';
import { render } from 'test/test-utils';

import { isOnPrem } from '../utils/isOnPrem';

import { QuotaLimitNote } from './QuotaLimitNote';

jest.mock('../utils/isOnPrem', () => ({
  isOnPrem: jest.fn(() => false),
}));

const mockIsOnPrem = jest.mocked(isOnPrem);

const EmptyWrapper = ({ children }: PropsWithChildren) => <Fragment>{children}</Fragment>;

function renderNote(props: Parameters<typeof QuotaLimitNote>[0] = {}) {
  return render(<QuotaLimitNote {...props} />, { wrapper: EmptyWrapper });
}

describe('QuotaLimitNote', () => {
  beforeEach(() => {
    mockIsOnPrem.mockReturnValue(false);
  });

  describe('rendering nothing', () => {
    it('should return null when no limits are set', () => {
      const { container } = renderNote();
      expect(container).toBeEmptyDOMElement();
    });

    it('should return null when both limits are zero', () => {
      const { container } = renderNote({ maxRepositories: 0, maxResourcesPerRepository: 0 });
      expect(container).toBeEmptyDOMElement();
    });

    it('should return null when limits are negative', () => {
      const { container } = renderNote({ maxRepositories: -1 });
      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('wrapper rendering', () => {
    it('should render with repository limit', () => {
      const { container } = renderNote({ maxRepositories: 3 });
      expect(container).not.toBeEmptyDOMElement();
      expect(container.textContent).toContain('Note:');
    });

    it('should render with resource limit', () => {
      const { container } = renderNote({ maxResourcesPerRepository: 100 });
      expect(container).not.toBeEmptyDOMElement();
      expect(container.textContent).toContain('Note:');
    });

    it('should render with both limits', () => {
      const { container } = renderNote({ maxRepositories: 3, maxResourcesPerRepository: 100 });
      expect(container).not.toBeEmptyDOMElement();
      expect(container.textContent).toContain('Note:');
    });
  });
});
