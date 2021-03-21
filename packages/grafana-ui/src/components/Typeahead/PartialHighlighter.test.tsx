import React from 'react';
import { shallow } from 'enzyme';
import { PartialHighlighter } from './PartialHighlighter';

describe('PartialHighlighter component', () => {
  it('should highlight inner parts correctly', () => {
    const wrapper = shallow(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 6, end: 10 },
          { start: 18, end: 20 },
        ]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('should highlight outer parts correctly', () => {
    const wrapper = shallow(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 0, end: 4 },
          { start: 22, end: 25 },
        ]}
      />
    );
    expect(wrapper).toMatchSnapshot();
  });
});
