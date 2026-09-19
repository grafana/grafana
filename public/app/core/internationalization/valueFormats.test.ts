import { formattedValueToString, getValueFormat } from '@grafana/data';
import { addResourceBundle, changeLanguage, getI18nInstance } from '@grafana/i18n/internal';

describe('ordinal unit', () => {
  afterEach(async () => {
    await changeLanguage('en-US');
  });

  it('renders French ordinal suffixes, which only distinguish "1er" from everything else', async () => {
    const toOrdinal = getValueFormat('ordinal');

    const ns = getI18nInstance().options.defaultNS;
    addResourceBundle('fr-FR', (Array.isArray(ns) ? ns[0] : ns) ?? 'translation', {
      'grafana-data': {
        valueFormats: {
          'ordinal-suffix_ordinal_one': 'er',
          'ordinal-suffix_ordinal_other': 'e',
        },
      },
    });

    await changeLanguage('fr-FR');

    expect(formattedValueToString(toOrdinal(1))).toBe('1er');
    expect(formattedValueToString(toOrdinal(2))).toBe('2e');
    expect(formattedValueToString(toOrdinal(3))).toBe('3e');
    expect(formattedValueToString(toOrdinal(11))).toBe('11e');
    expect(formattedValueToString(toOrdinal(21))).toBe('21e');
  });

  it('resolves the CLDR "many" ordinal category (used by Italian, among others)', async () => {
    const toOrdinal = getValueFormat('ordinal');

    const ns = getI18nInstance().options.defaultNS;
    // Fabricated strings, not real Italian text: this proves the "many" category (Italian's
    // ordinal rule assigns it to numbers like 8, 11, 18, 80) is wired up and distinguishable
    // from "other", not that Italian specifically needs different suffixes per category.
    addResourceBundle('it-IT', (Array.isArray(ns) ? ns[0] : ns) ?? 'translation', {
      'grafana-data': {
        valueFormats: {
          'ordinal-suffix_ordinal_many': 'MANY',
          'ordinal-suffix_ordinal_other': 'OTHER',
        },
      },
    });

    await changeLanguage('it-IT');

    expect(formattedValueToString(toOrdinal(8))).toBe('8MANY');
    expect(formattedValueToString(toOrdinal(11))).toBe('11MANY');
    expect(formattedValueToString(toOrdinal(80))).toBe('80MANY');
    expect(formattedValueToString(toOrdinal(21))).toBe('21OTHER');
  });
});
