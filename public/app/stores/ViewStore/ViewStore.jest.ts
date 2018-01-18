import { ViewStore } from './ViewStore';
import { toJS } from 'mobx';

describe('ViewStore', () => {
  let store;

  beforeAll(() => {
    store = ViewStore.create({
      path: '',
      query: {},
    });
  });

  it('Can update path and query', () => {
    store.updatePathAndQuery('/hello', { key: 1, otherParam: 'asd' });
    expect(store.path).toBe('/hello');
    expect(store.query.get('key')).toBe(1);
    expect(store.currentUrl).toBe('/hello?key=1&otherParam=asd');
  });

  it('Query can contain arrays', () => {
    store.updatePathAndQuery('/hello', { values: ['A', 'B'] });
    expect(toJS(store.query.get('values'))).toMatchObject(['A', 'B']);
    expect(store.currentUrl).toBe('/hello?values=A&values=B');
  });
});
