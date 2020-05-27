import React from 'react';
import PageHeader from './PageHeader';
import { shallow, ShallowWrapper } from 'enzyme';

describe('PageHeader', () => {
  let wrapper: ShallowWrapper<PageHeader>;

  describe('when the nav tree has a node with a title', () => {
    beforeAll(() => {
      const nav = {
        main: {
          icon: 'folder-open',
          id: 'node',
          subTitle: 'node subtitle',
          url: '',
          text: 'node',
        },
        node: {},
      };
      wrapper = shallow(<PageHeader model={nav as any} />);
    });

    it('should render the title', () => {
      const title = wrapper.find('.page-header__title');
      expect(title.text()).toBe('node');
    });
  });

  describe('when the nav tree has a node with breadcrumbs and a title', () => {
    beforeAll(() => {
      const nav = {
        main: {
          icon: 'folder-open',
          id: 'child',
          subTitle: 'child subtitle',
          url: '',
          text: 'child',
          breadcrumbs: [{ title: 'Parent', url: 'parentUrl' }],
        },
        node: {},
      };
      wrapper = shallow(<PageHeader model={nav as any} />);
    });

    it('should render the title with breadcrumbs first and then title last', () => {
      const title = wrapper.find('.page-header__title');
      expect(title.text()).toBe('Parent / child');

      const parentLink = wrapper.find('.page-header__title > a.text-link');
      expect(parentLink.prop('href')).toBe('parentUrl');
    });
  });
});
