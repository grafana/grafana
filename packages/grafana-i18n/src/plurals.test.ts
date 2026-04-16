import { filterPluralKeys } from './plurals';

describe('filterPluralKeys', () => {
  it('should keep only plural-suffixed keys from a flat object', () => {
    const input = {
      hello: 'Hi',
      item_one: '1 item',
      item_other: '{{count}} items',
    };

    expect(filterPluralKeys(input)).toEqual({
      item_one: '1 item',
      item_other: '{{count}} items',
    });
  });

  it('should keep plural keys in nested objects and prune non-plural branches', () => {
    const input = {
      'browse-dashboards': {
        counts: {
          folder_one: '{{count}} folder',
          folder_other: '{{count}} folders',
          title: 'Browse',
        },
        header: {
          title: 'Dashboards',
          subtitle: 'Manage your dashboards',
        },
      },
    };

    expect(filterPluralKeys(input)).toEqual({
      'browse-dashboards': {
        counts: {
          folder_one: '{{count}} folder',
          folder_other: '{{count}} folders',
        },
      },
    });
  });

  it('should prune empty branches entirely', () => {
    const input = {
      section: {
        title: 'Hello',
        subtitle: 'World',
      },
    };

    expect(filterPluralKeys(input)).toEqual({});
  });

  it('should handle all i18next plural suffixes', () => {
    const input = {
      key_zero: 'zero',
      key_one: 'one',
      key_two: 'two',
      key_few: 'few',
      key_many: 'many',
      key_other: 'other',
      key_invalid: 'not a plural',
    };

    expect(filterPluralKeys(input)).toEqual({
      key_zero: 'zero',
      key_one: 'one',
      key_two: 'two',
      key_few: 'few',
      key_many: 'many',
      key_other: 'other',
    });
  });

  it('should not match keys where suffix is part of a word (e.g. "everyone")', () => {
    const input = {
      everyone: 'Everyone',
      someone: 'Someone',
      leftover_none: 'None left',
    };

    expect(filterPluralKeys(input)).toEqual({});
  });

  it('should return an empty object for empty input', () => {
    expect(filterPluralKeys({})).toEqual({});
  });

  it('should not mutate the input object', () => {
    const input = {
      section: {
        item_one: '1 item',
        item_other: '{{count}} items',
        title: 'Section',
      },
    };
    const inputCopy = JSON.parse(JSON.stringify(input));

    filterPluralKeys(input);

    expect(input).toEqual(inputCopy);
  });

  it('should handle deeply nested plural keys', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            count_one: '{{count}} thing',
            count_other: '{{count}} things',
          },
        },
      },
    };

    expect(filterPluralKeys(input)).toEqual({
      level1: {
        level2: {
          level3: {
            count_one: '{{count}} thing',
            count_other: '{{count}} things',
          },
        },
      },
    });
  });
});
