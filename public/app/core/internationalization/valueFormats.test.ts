import { formattedValueToString, getValueFormat } from '@grafana/data';
import { addResourceBundle, changeLanguage, getI18nInstance } from '@grafana/i18n/internal';

describe('ordinal unit', () => {
  const ns = getI18nInstance().options.defaultNS;
  const namespace = (Array.isArray(ns) ? ns[0] : ns) ?? 'translation';

  afterEach(async () => {
    getI18nInstance().removeResourceBundle('fr-FR', namespace);
    getI18nInstance().removeResourceBundle('it-IT', namespace);
    await changeLanguage('en-US');
  });

  it('renders French ordinal suffixes, which only distinguish "1er" from everything else', async () => {
    const toOrdinal = getValueFormat('ordinal');

    addResourceBundle('fr-FR', namespace, {
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

  it('falls back to the "other" suffix for an ordinal category with no translated key of its own', async () => {
    const toOrdinal = getValueFormat('ordinal');

    // Italian's ordinal rule assigns numbers like 8, 11, 18 and 80 to the CLDR "many" category,
    // which en-US never extracts a key for (English's own ordinal rule has no "many"). Only
    // "other" is translated here, simulating that gap.
    addResourceBundle('it-IT', namespace, {
      'grafana-data': {
        valueFormats: {
          'ordinal-suffix_ordinal_other': 'OTHER',
        },
      },
    });

    await changeLanguage('it-IT');

    expect(formattedValueToString(toOrdinal(8))).toBe('8OTHER');
    expect(formattedValueToString(toOrdinal(11))).toBe('11OTHER');
    expect(formattedValueToString(toOrdinal(80))).toBe('80OTHER');
    expect(formattedValueToString(toOrdinal(21))).toBe('21OTHER');
  });

  it('resolves the CLDR "many" ordinal category once it has its own translated key', async () => {
    const toOrdinal = getValueFormat('ordinal');

    // Fabricated strings, not real Italian text: this proves the "many" category is wired up and
    // distinguishable from "other" once translated, not that Italian specifically needs
    // different suffixes per category.
    addResourceBundle('it-IT', namespace, {
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
