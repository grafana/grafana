import React from 'react';
import { mount } from 'enzyme';
import TopSectionItem from './TopSectionItem';
import { locationService } from '@grafana/runtime';
import { Router } from 'react-router-dom';

const setup = (propOverrides?: object) => {
  const props = Object.assign(
    {
      link: {
        text: 'Hello',
        icon: 'cloud',
        url: '/asd',
      },
    },
    propOverrides
  );

  return mount(
    <Router history={locationService.getHistory()}>
      <TopSectionItem {...props} />
    </Router>
  );
};

describe('Render', () => {
  it('should render component', () => {
    const wrapper = setup();
    expect(wrapper).toMatchSnapshot();
  });
});
