import { toIncidentFilterOptions } from './incidentsApi';

const teamField = { slug: 'team', name: 'Team', domainName: 'labels', selectoptions: [{ value: 'Platform' }] };

describe('toIncidentFilterOptions', () => {
  it('offers every value of every label field, naming the field it belongs to', () => {
    const squadField = {
      slug: 'squad',
      name: 'Squad',
      domainName: 'labels',
      selectoptions: [{ value: 'Frontend' }, { value: 'Backend' }],
    };

    expect(toIncidentFilterOptions({ fields: [teamField, squadField] })).toEqual([
      { slug: 'team', fieldName: 'Team', value: 'Platform' },
      { slug: 'squad', fieldName: 'Squad', value: 'Frontend' },
      { slug: 'squad', fieldName: 'Squad', value: 'Backend' },
    ]);
  });

  it.each([
    {
      case: 'an archived field',
      fields: [{ ...teamField, slug: 'owner', archived: true }],
    },
    {
      case: 'an archived select option',
      fields: [{ ...teamField, selectoptions: [{ value: 'Legacy', archived: true }] }],
    },
    {
      case: 'the free-form tags field, whatever its casing',
      fields: [
        { ...teamField, slug: 'tags', selectoptions: [{ value: 'outage' }] },
        { ...teamField, slug: 'Tags', selectoptions: [{ value: 'outage' }] },
      ],
    },
    {
      // Custom fields outside the labels domain aren't labels, even when they're selects.
      case: 'a custom field outside the labels domain',
      fields: [{ slug: 'region', name: 'Region', domainName: 'incident', selectoptions: [{ value: 'EU' }] }],
    },
    {
      case: 'a blank value',
      fields: [{ ...teamField, selectoptions: [{ value: '  ' }] }],
    },
    {
      // No escape form in the Incident lexer, so such a value can't be put in a query.
      case: 'a value containing both quote kinds',
      fields: [{ ...teamField, selectoptions: [{ value: `Ops "A" 'B'` }] }],
    },
  ])('offers nothing for $case', ({ fields }) => {
    expect(toIncidentFilterOptions({ fields })).toEqual([]);
  });

  it('hides values the org archived as label pairs, matching on the field slug', () => {
    const squadField = {
      slug: 'squad',
      name: 'Squad',
      domainName: 'labels',
      selectoptions: [{ value: 'Frontend' }, { value: 'Backend' }],
    };

    const options = toIncidentFilterOptions({
      fields: [squadField],
      archived: [{ key: 'squad', value: 'Backend' }],
    });

    expect(options.map((option) => option.value)).toEqual(['Frontend']);
  });

  it('returns nothing for an org with no fields', () => {
    expect(toIncidentFilterOptions({})).toEqual([]);
  });
});
