import { Field, FieldType } from '@grafana/data';

import { getDataLinks } from './utils';

describe('getDataLinks', () => {
  it('returns an empty array when there are no links configured', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {},
    };

    const links = getDataLinks(field, 0);
    expect(links).toEqual([]);
  });

  it('returns an empty array if getLinks is not defined', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {
        links: [{ title: 'Link 1', url: 'http://example.com' }],
      },
    };

    const links = getDataLinks(field, 0);
    expect(links).toEqual([]);
  });

  it('returns links from getLinks function', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {
        links: [{ title: 'Link 1', url: 'http://example.com' }],
      },
      display: jest.fn((v) => ({ text: `Value: ${v}`, numeric: Number(v) })),
      getLinks: jest.fn(({ calculatedValue }) => [
        { title: `Link ${calculatedValue?.text}`, href: 'http://example.com', target: '_blank', origin: field },
      ]),
    };

    expect(getDataLinks(field, 0)).toEqual([
      { title: `Link Value: 1`, href: 'http://example.com', target: '_blank', origin: field },
    ]);
  });

  it('deduplicates links based on title and href', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.number,
      values: [1, 2, 3],
      config: {
        links: [{ title: 'Link 1', url: 'http://example.com' }],
      },
      display: jest.fn((v) => ({ text: `Value: ${v}`, numeric: Number(v) })),
      getLinks: jest.fn(() => [
        { title: 'Duplicate Link', href: 'http://example.com', target: '_blank', origin: field },
        { title: 'Duplicate Link', href: 'http://example.com', target: '_blank', origin: field },
      ]),
    };

    const links = getDataLinks(field, 0);
    expect(links).toEqual([{ title: 'Duplicate Link', href: 'http://example.com', target: '_blank', origin: field }]);
  });
});
