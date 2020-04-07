import React, { useContext } from 'react';
import { render } from 'enzyme';
import { CallToActionCard, CallToActionCardProps } from './CallToActionCard';
import { ThemeContext } from '../../themes';

type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

const TestRenderer = (props: Omit<CallToActionCardProps, 'theme'>) => {
  const theme = useContext(ThemeContext);
  return <CallToActionCard theme={theme} {...props} />;
};

describe('CallToActionCard', () => {
  describe('rendering', () => {
    it('when no message and footer provided', () => {
      const tree = render(<TestRenderer callToActionElement={<a href="http://dummy.link">Click me</a>} />);
      expect(tree).toMatchSnapshot();
    });

    it('when message and no footer provided', () => {
      const tree = render(
        <TestRenderer message="Click button bellow" callToActionElement={<a href="http://dummy.link">Click me</a>} />
      );
      expect(tree).toMatchSnapshot();
    });

    it('when message and footer provided', () => {
      const tree = render(
        <TestRenderer
          message="Click button bellow"
          footer="footer content"
          callToActionElement={<a href="http://dummy.link">Click me</a>}
        />
      );
      expect(tree).toMatchSnapshot();
    });
  });
});
