import { getIncidentFilterOptions } from './incidentsApi';

const teamField = { slug: 'team', name: 'Team', type: 'single-select', selectoptions: [{ value: 'Platform' }] };

describe('getIncidentFilterOptions', () => {
  it('offers every value of every select field, naming the field it belongs to', () => {
    const squadField = {
      slug: 'squad',
      name: 'Squad',
      type: 'multi-select',
      selectoptions: [{ value: 'Frontend' }, { value: 'Backend' }],
    };

    expect(getIncidentFilterOptions({ fields: [teamField, squadField] })).toEqual([
      { slug: 'team', fieldName: 'Team', value: 'Platform' },
      { slug: 'squad', fieldName: 'Squad', value: 'Frontend' },
      { slug: 'squad', fieldName: 'Squad', value: 'Backend' },
    ]);
  });

  it('falls back to the slug when a field has no display name', () => {
    expect(getIncidentFilterOptions({ fields: [{ ...teamField, name: undefined }] })).toEqual([
      { slug: 'team', fieldName: 'team', value: 'Platform' },
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
        { ...teamField, slug: 'tags', type: 'multi-select', selectoptions: [{ value: 'outage' }] },
        { ...teamField, slug: 'Tags', type: 'multi-select', selectoptions: [{ value: 'outage' }] },
      ],
    },
    {
      case: 'a non-select field',
      fields: [{ slug: 'region', name: 'Region', type: 'string' }],
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
    expect(getIncidentFilterOptions({ fields })).toEqual([]);
  });

  it('hides values the org archived as label pairs, matching on the field slug', () => {
    const squadField = {
      slug: 'squad',
      name: 'Squad',
      type: 'multi-select',
      selectoptions: [{ value: 'Frontend' }, { value: 'Backend' }],
    };

    const options = getIncidentFilterOptions({
      fields: [squadField],
      archived: [{ key: 'squad', value: 'Backend' }],
    });

    expect(options.map((option) => option.value)).toEqual(['Frontend']);
  });

  it('returns nothing for an org with no fields', () => {
    expect(getIncidentFilterOptions({})).toEqual([]);
  });
});
