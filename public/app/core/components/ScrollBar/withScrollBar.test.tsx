import React from 'react';
import renderer from 'react-test-renderer';
import withScrollBar from './withScrollBar';

class TestComponent extends React.Component {
  render() {
    return <div className="my-component" />;
  }
}

describe('withScrollBar', () => {
  it('renders correctly', () => {
    const TestComponentWithScroll = withScrollBar(TestComponent);
    const tree = renderer
      .create(
        <TestComponentWithScroll>
          <p>Scrollable content</p>
        </TestComponentWithScroll>
      )
      .toJSON();
    expect(tree).toMatchSnapshot();
  });
});
