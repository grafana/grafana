import { toFixed, getValueFormat } from './valueFormats';

describe('kbn.toFixed and negative decimals', () => {
  it('should treat as zero decimals', () => {
    const str = toFixed(186.123, -2);
    expect(str).toBe('186');
  });
});

describe('kbn ms format when scaled decimals is null do not use it', () => {
  it('should use specified decimals', () => {
    const str = getValueFormat('ms')(10000086.123, 1, null);
    expect(str).toBe('2.8 hour');
  });
});

describe('kbn kbytes format when scaled decimals is null do not use it', () => {
  it('should use specified decimals', () => {
    const str = getValueFormat('kbytes')(10000000, 3, null);
    expect(str).toBe('9.537 GiB');
  });
});

describe('kbn deckbytes format when scaled decimals is null do not use it', () => {
  it('should use specified decimals', () => {
    const str = getValueFormat('deckbytes')(10000000, 3, null);
    expect(str).toBe('10.000 GB');
  });
});
