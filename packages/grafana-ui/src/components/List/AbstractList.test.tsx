import React from 'react';
import { shallow } from 'enzyme';
import { AbstractList } from './AbstractList';

describe('AbstractList', () => {
  it('renders items using renderItem prop function', () => {
    const items = [{ name: 'Item 1', id: 'item1' }, { name: 'Item 2', id: 'item2' }, { name: 'Item 3', id: 'item3' }];

    const list = shallow(
      <AbstractList
        items={items}
        renderItem={item => (
          <div>
            <h1>{item.name}</h1>
            <small>{item.id}</small>
          </div>
        )}
      />
    );

    expect(list).toMatchSnapshot();
  });

  it('allows custom item key', () => {
    const items = [{ name: 'Item 1', id: 'item1' }, { name: 'Item 2', id: 'item2' }, { name: 'Item 3', id: 'item3' }];

    const list = shallow(
      <AbstractList
        items={items}
        getItemKey={item => item.id}
        renderItem={item => (
          <div>
            <h1>{item.name}</h1>
            <small>{item.id}</small>
          </div>
        )}
      />
    );

    expect(list).toMatchSnapshot();
  });
});
