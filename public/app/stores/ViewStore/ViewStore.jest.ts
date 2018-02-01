import { ViewStore } from './ViewStore';
import { toJS } from 'mobx';

describe('ViewStore', () => {
  let store;

  beforeAll(() => {
    store = ViewStore.create({
      path: '',
      query: {},
      routeParams: {},
    });
  });

  it('Can update path and query', () => {
    store.updatePathAndQuery('/hello', { key: 1, otherParam: 'asd' }, { key: 1, otherParam: 'asd' });
    expect(store.path).toBe('/hello');
    expect(store.query.get('key')).toBe(1);
    expect(store.currentUrl).toBe('/hello?key=1&otherParam=asd');
  });

  it('Query can contain arrays', () => {
    store.updatePathAndQuery('/hello', { values: ['A', 'B'] }, { key: 1, otherParam: 'asd' });
    expect(toJS(store.query.get('values'))).toMatchObject(['A', 'B']);
    expect(store.currentUrl).toBe('/hello?values=A&values=B');
  });

  it('Query can contain boolean', () => {
    store.updatePathAndQuery('/hello', { abool: true }, { abool: true });
    expect(toJS(store.query.get('abool'))).toBe(true);
    expect(store.currentUrl).toBe('/hello?abool');
  });
});
