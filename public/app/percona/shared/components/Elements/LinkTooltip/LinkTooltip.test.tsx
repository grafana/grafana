import React from 'react';
import { shallow } from 'enzyme';
import { LinkTooltip } from './LinkTooltip';

const testProps = {
  tooltipText: 'Test text',
  link: 'Test link',
  linkText: 'Test link text',
  dataTestId: 'link-tooltip',
};

describe('LinkTooltip::', () => {
  it('Renders icon correctly', () => {
    const root = shallow(<LinkTooltip icon="question-circle" {...testProps} />);

    expect(root.children().length).toEqual(1);
  });
});
