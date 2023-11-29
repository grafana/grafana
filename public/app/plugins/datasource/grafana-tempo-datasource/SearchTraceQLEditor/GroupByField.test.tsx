import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { TempoQuery } from '../types';

import { GroupByField } from './GroupByField';

describe('GroupByField', () => {
  let user: ReturnType<typeof userEvent.setup>;

  const datasource: TempoDatasource = {
    search: {
      filters: [],
    },
  } as unknown as TempoDatasource;

  const lp = new TempoLanguageProvider(datasource);
  datasource.languageProvider = lp;

  let query: TempoQuery = {
    refId: 'A',
    queryType: 'traceqlSearch',
    query: '',
    filters: [],
    groupBy: [{ id: 'group-by-id', scope: TraceqlSearchScope.Span, tag: 'component' }],
  };

  const onChange = (q: TempoQuery) => {
    query = q;
  };

  jest.spyOn(lp, 'getMetricsSummaryTags').mockReturnValue(['component', 'http.method', 'http.status_code']);

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should update scope when new value is selected in scope input', async () => {
    const { container } = render(
      <GroupByField datasource={datasource} query={query} onChange={onChange} isTagsLoading={false} />
    );

    const scopeSelect = container.querySelector(`input[aria-label="Select scope for filter 1"]`);
    expect(scopeSelect).not.toBeNull();
    expect(scopeSelect).toBeInTheDocument();

    if (scopeSelect) {
      await user.click(scopeSelect);
      jest.advanceTimersByTime(1000);
      const resourceScope = await screen.findByText('resource');
      await user.click(resourceScope);
      const groupByFilter = query.groupBy?.find((f) => f.id === 'group-by-id');
      expect(groupByFilter).not.toBeNull();
      expect(groupByFilter?.scope).toBe('resource');
      expect(groupByFilter?.tag).toBe('');
    }
  });

  it('should update tag when new value is selected in tag input', async () => {
    const { container } = render(
      <GroupByField datasource={datasource} query={query} onChange={onChange} isTagsLoading={false} />
    );

    const tagSelect = container.querySelector(`input[aria-label="Select tag for filter 1"]`);
    expect(tagSelect).not.toBeNull();
    expect(tagSelect).toBeInTheDocument();

    if (tagSelect) {
      await user.click(tagSelect);
      jest.advanceTimersByTime(1000);
      const tag = await screen.findByText('http.method');
      await user.click(tag);
      const groupByFilter = query.groupBy?.find((f) => f.id === 'group-by-id');
      expect(groupByFilter).not.toBeNull();
      expect(groupByFilter?.tag).toBe('http.method');
    }
  });
});
