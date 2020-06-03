import React from 'react';
import { mount } from 'enzyme';

import { Typeahead, State } from './Typeahead';
import { TypeaheadItem } from './TypeaheadItem';
import { CompletionItemKind } from '../../types';

describe('Typeahead', () => {
  const completionItemGroups = [{ label: 'my group', items: [{ label: 'first item' }] }];
  describe('when closed', () => {
    it('renders nothing when no items given', () => {
      const component = mount(<Typeahead origin="test" groupedItems={[]} />);
      expect(component.find('.typeahead')).toHaveLength(0);
    });
    it('renders nothing when items given', () => {
      const component = mount(<Typeahead origin="test" groupedItems={completionItemGroups} />);
      expect(component.find('.typeahead')).toHaveLength(0);
    });
  });
  describe('when open', () => {
    it('renders given items and nothing is selected', () => {
      const component = mount(<Typeahead origin="test" groupedItems={completionItemGroups} isOpen />);
      expect(component.find('.typeahead')).toHaveLength(1);
      const items = component.find(TypeaheadItem);
      expect(items).toHaveLength(2);
      expect(items.get(0).props.item.kind).toEqual(CompletionItemKind.GroupTitle);
      expect(items.get(0).props.isSelected).toBeFalsy();
      expect(items.get(1).props.item.label).toEqual('first item');
      expect(items.get(1).props.isSelected).toBeFalsy();
    });
  });
  it('selected the first non-group item on moving to first item', () => {
    const component = mount(<Typeahead origin="test" groupedItems={completionItemGroups} isOpen />);
    expect(component.find('.typeahead')).toHaveLength(1);
    let items = component.find(TypeaheadItem);

    expect(items).toHaveLength(2);
    expect((component.state() as State).typeaheadIndex).toBe(null);
    (component.instance() as Typeahead).moveMenuIndex(1);
    expect((component.state() as State).typeaheadIndex).toBe(1);
    component.setProps({});
    items = component.find(TypeaheadItem);
    expect(items.get(0).props.isSelected).toBeFalsy();
    expect(items.get(1).props.isSelected).toBeTruthy();
  });
});
