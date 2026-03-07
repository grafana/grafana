import { quoteTableIdentifierIfNecessary } from './sqlIdentifier';

describe('quoteTableIdentifierIfNecessary', () => {
  it('quotes table identifiers with spaces', () => {
    expect(quoteTableIdentifierIfNecessary('gdp per capita')).toBe('`gdp per capita`');
  });

  it('does not double quote already quoted table identifiers', () => {
    expect(quoteTableIdentifierIfNecessary('`gdp per capita`')).toBe('`gdp per capita`');
  });
});
