import { mount, ReactWrapper } from 'enzyme';
import React from 'react';

import { PartialHighlighter } from './PartialHighlighter';

function assertPart(component: ReactWrapper, isHighlighted: boolean, text: string): void {
  expect(component.type()).toEqual(isHighlighted ? 'mark' : 'span');
  expect(component.hasClass('highlight')).toEqual(isHighlighted);
  expect(component.text()).toEqual(text);
}

describe('PartialHighlighter component', () => {
  it('should highlight inner parts correctly', () => {
    const component = mount(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 6, end: 10 },
          { start: 18, end: 20 },
        ]}
      />
    );
    const main = component.find('div');

    assertPart(main.childAt(0), false, 'Lorem ');
    assertPart(main.childAt(1), true, 'ipsum');
    assertPart(main.childAt(2), false, ' dolor ');
    assertPart(main.childAt(3), true, 'sit');
    assertPart(main.childAt(4), false, ' amet');
  });

  it('should highlight outer parts correctly', () => {
    const component = mount(
      <PartialHighlighter
        text="Lorem ipsum dolor sit amet"
        highlightClassName="highlight"
        highlightParts={[
          { start: 0, end: 4 },
          { start: 22, end: 25 },
        ]}
      />
    );
    const main = component.find('div');
    assertPart(main.childAt(0), true, 'Lorem');
    assertPart(main.childAt(1), false, ' ipsum dolor sit ');
    assertPart(main.childAt(2), true, 'amet');
  });

  it('returns null if highlightParts is empty', () => {
    const component = mount(
      <PartialHighlighter text="Lorem ipsum dolor sit amet" highlightClassName="highlight" highlightParts={[]} />
    );
    expect(component.html()).toBe(null);
  });
});
