import { e2e } from '../../../dist';

describe('API', () => {
  it('can be imported', () => {
    expect(e2e).to.be.a('function');
  });
});
