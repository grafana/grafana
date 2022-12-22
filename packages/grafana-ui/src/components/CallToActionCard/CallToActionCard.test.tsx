import { render, screen } from '@testing-library/react';
import React from 'react';

import { CallToActionCard } from './CallToActionCard';

describe('CallToActionCard', () => {
  describe('rendering', () => {
    it('should render callToActionElement', () => {
      render(<CallToActionCard callToActionElement={<a href="http://dummy.link">Click me</a>} />);
      expect(screen.getByRole('link', { name: 'Click me' })).toBeInTheDocument();
    });

    it('should render message when provided', () => {
      render(
        <CallToActionCard message="Click button below" callToActionElement={<a href="http://dummy.link">Click me</a>} />
      );
      expect(screen.getByText('Click button below')).toBeInTheDocument();
    });

    it('should render footer when provided', () => {
      render(
        <CallToActionCard footer="footer content" callToActionElement={<a href="http://dummy.link">Click me</a>} />
      );
      expect(screen.getByText('footer content')).toBeInTheDocument();
    });

    it('should render both message and footer when provided', () => {
      render(
        <CallToActionCard
          message="Click button below"
          footer="footer content"
          callToActionElement={<a href="http://dummy.link">Click me</a>}
        />
      );
      expect(screen.getByText('Click button below')).toBeInTheDocument();
      expect(screen.getByText('footer content')).toBeInTheDocument();
    });
  });
});
