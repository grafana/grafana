import React from 'react';
import { shallow } from 'enzyme';
import { OptionContent } from './OptionContent';

const title = 'Shared Blocks Written';
const description = 'Total number of shared blocks written by the statement';
const tags = ['mysql', 'postgresql'];

describe('OptionContent::', () => {
  it('should render with title, description and tags', () => {
    const root = shallow(<OptionContent title={title} description={description} tags={tags} />);
    const spans = root.find('div > div > span');

    expect(spans.at(0).text()).toEqual(title);
    expect(spans.at(1).text()).toEqual(description);
    expect(spans.at(2).text()).toEqual(tags[0]);
    expect(spans.at(3).text()).toEqual(tags[1]);
  });

  it('should render with title, description and one tag', () => {
    const root = shallow(<OptionContent title={title} description={description} tags={[tags[0]]} />);
    const spans = root.find('div > div > span');

    expect(spans.at(0).text()).toEqual(title);
    expect(spans.at(1).text()).toEqual(description);
    expect(spans.at(2).text()).toEqual(tags[0]);
  });

  it('should render with title, description and empty tags', () => {
    const root = shallow(<OptionContent title={title} description={description} tags={[]} />);
    const spans = root.find('div > div > span');

    expect(spans.at(0).text()).toEqual(title);
    expect(spans.at(1).text()).toEqual(description);
    expect(spans.length).toEqual(2);
  });
});
