import { FieldType, type Field, type LinkModel, type ValueLinkConfig } from '@grafana/data';

import { getCellLinks } from './dataLinks';

describe('getCellLinks', () => {
  it('should return undefined when field has no getLinks function', () => {
    const field: Field = { name: 'test', type: FieldType.string, config: {}, values: ['value'] };

    const links = getCellLinks(field, 0);
    expect(links).toEqual(undefined);
  });

  it('should return links from field getLinks function', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
      { title: 'Link 2', href: 'http://example.com/2', target: '_self', origin: { datasourceUid: 'test' } },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1', 'value2'],
      getLinks: (config: ValueLinkConfig) => {
        return config.valueRowIndex === 0 ? mockLinks : [];
      },
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual(mockLinks);
  });

  it('should return empty array for out of bounds index', () => {
    const mockLinks: LinkModel[] = [
      { title: 'Link 1', href: 'http://example.com/1', target: '_blank', origin: { datasourceUid: 'test' } },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (config: ValueLinkConfig) => {
        return config.valueRowIndex === 0 ? mockLinks : [];
      },
    };

    // Index out of bounds
    const links = getCellLinks(field, 1);
    expect(links).toEqual([]);
  });

  it('should handle getLinks returning undefined', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (config: ValueLinkConfig) => {
        return [];
      },
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual([]);
  });

  it('should handle different link configurations', () => {
    // Create links with different valid configurations
    const mockLinks: LinkModel[] = [
      // Standard link with href
      {
        title: 'External Link',
        href: 'http://example.com/full',
        target: '_blank',
        origin: { datasourceUid: 'test' },
      },
      // Internal link with onClick handler
      {
        title: 'Internal Link',
        href: '', // Empty href for internal links
        onClick: jest.fn(),
        target: '_self',
        origin: { datasourceUid: 'test' },
      },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: () => mockLinks,
    };

    const links = getCellLinks(field, 0);

    // Verify links are returned unmodified
    expect(links).toEqual(mockLinks);

    // Verify we have both types of links
    expect(links?.find((link) => link.onClick !== undefined)).toBeDefined();
    expect(links?.find((link) => link.href === 'http://example.com/full')).toBeDefined();
  });

  it('should bind the onClick handlers', () => {
    const onClickHandler = jest.fn();
    // Create links with different valid configurations
    const mockLinks: LinkModel[] = [
      // Internal link with onClick handler
      {
        title: 'Internal Link',
        href: '', // Empty href for internal links
        onClick: onClickHandler,
        target: '_self',
        origin: { datasourceUid: 'test' },
      },
    ];

    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: () => mockLinks,
    };

    const links = getCellLinks(field, 0);

    const link = links?.[0];
    const event = new MouseEvent('click', { bubbles: true });
    jest.spyOn(event, 'preventDefault');

    link?.onClick?.(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onClickHandler).toHaveBeenCalledWith(event, { field, rowIndex: 0 });
  });

  it.each([
    { keyName: 'metaKey', eventOverride: { metaKey: true } },
    { keyName: 'ctrlKey', eventOverride: { ctrlKey: true } },
    { keyName: 'shiftKey', eventOverride: { shiftKey: true } },
  ])(
    'should allow open a link in a new tab when $keyName clicked instead of using the handler',
    ({ eventOverride }) => {
      const onClickHandler = jest.fn();
      // Create links with different valid configurations
      const mockLinks: LinkModel[] = [
        // Internal link with onClick handler
        {
          title: 'Internal Link',
          href: '', // Empty href for internal links
          onClick: onClickHandler,
          target: '_self',
          origin: { datasourceUid: 'test' },
        },
      ];

      const field: Field = {
        name: 'test',
        type: FieldType.string,
        config: {},
        values: ['value1'],
        getLinks: () => mockLinks,
      };

      const links = getCellLinks(field, 0);

      const link = links?.[0];
      const event = new MouseEvent('click', { bubbles: true, ...eventOverride });
      jest.spyOn(event, 'preventDefault');

      link?.onClick?.(event);

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(onClickHandler).not.toHaveBeenCalled();
    }
  );

  it('should filter out links which contain neither href nor onClick', () => {
    const field: Field = {
      name: 'test',
      type: FieldType.string,
      config: {},
      values: ['value1'],
      getLinks: (): LinkModel[] => [
        { title: 'Invalid Link', target: '_blank', origin: { datasourceUid: 'test' } } as LinkModel, // No href or onClick
      ],
    };

    const links = getCellLinks(field, 0);
    expect(links).toEqual([]);
  });
});
