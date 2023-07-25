jest.mock('panel-exporter', () => jest.fn()); // look at what happens here

describe('Panel-Exporter', () => {
  it('should work', () => {
    console.log('hi');
  });
});
