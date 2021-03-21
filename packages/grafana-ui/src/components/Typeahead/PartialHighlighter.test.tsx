import React from 'react';
import { shallow } from 'enzyme';
import { PartialHighlighter } from './PartialHighlighter';

describe('PartialHighlighter component', () => {
  it('should render', () => {
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
});
