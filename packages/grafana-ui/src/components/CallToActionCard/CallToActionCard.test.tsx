import React from 'react';
import { render } from 'enzyme';
import { CallToActionCard } from './CallToActionCard';

describe('CallToActionCard', () => {
  describe('rendering', () => {
    it('when no message and footer provided', () => {
      const tree = render(<CallToActionCard callToActionElement={<a href="http://dummy.link">Click me</a>} />);
      expect(tree).toMatchSnapshot();
    });

    it('when message and no footer provided', () => {
      const tree = render(
        <CallToActionCard
          message="Click button bellow"
          callToActionElement={<a href="http://dummy.link">Click me</a>}
        />
      );
      expect(tree).toMatchSnapshot();
    });

    it('when message and footer provided', () => {
      const tree = render(
        <CallToActionCard
          message="Click button bellow"
          footer="footer content"
          callToActionElement={<a href="http://dummy.link">Click me</a>}
        />
      );
      expect(tree).toMatchSnapshot();
    });
  });
});
