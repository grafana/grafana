import { render, screen } from '@testing-library/react';

import { createTheme } from '@grafana/data';
import { mockThemeContext } from '@grafana/ui';

import { notFoundItem } from './notFound';

const NotFoundDisplay = notFoundItem.display;

describe('notFoundItem', () => {
  let restoreThemeContext: () => void;

  beforeAll(() => {
    restoreThemeContext = mockThemeContext(createTheme());
  });

  afterAll(() => {
    restoreThemeContext();
  });

  describe('getNewOptions', () => {
    it('produces an empty config', () => {
      expect(notFoundItem.getNewOptions().config).toEqual({});
    });
  });

  describe('display', () => {
    it('renders the not-found message and the serialized config', () => {
      const config = { type: 'mystery-element', name: 'broken' };
      const { container } = render(<NotFoundDisplay config={config} />);

      expect(screen.getByText(/Not found/)).toBeInTheDocument();
      // the unknown element's config is dumped as JSON so users can see what failed to resolve
      expect(container.textContent).toContain('mystery-element');
    });
  });
});
