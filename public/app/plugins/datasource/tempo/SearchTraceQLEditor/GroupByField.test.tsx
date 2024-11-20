import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { initTemplateSrv } from '../test/test_utils';
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
  jest.spyOn(lp, 'getTags').mockReturnValue(['component', 'http.method', 'http.status_code']);

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });

    initTemplateSrv([{ name: 'templateVariable1' }, { name: 'templateVariable2' }], {});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should only show add/remove tag when necessary', async () => {
    const GroupByWithProps = () => {
      const [query, setQuery] = useState<TempoQuery>({
        refId: 'A',
        queryType: 'traceqlSearch',
        key: 'Q-595a9bbc-2a25-49a7-9249-a52a0a475d83-0',
        filters: [],
        groupBy: [{ id: 'group-by-id', scope: TraceqlSearchScope.Span }],
      });
      return (
        <GroupByField
          datasource={datasource}
          query={query}
          onChange={(q: TempoQuery) => setQuery(q)}
          isTagsLoading={false}
        />
      );
    };
    render(<GroupByWithProps />);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
    expect(screen.queryAllByLabelText(/Remove tag/).length).toBe(0); // mot filled in the default tag, so no values to remove
    expect(screen.getAllByText('Select tag').length).toBe(1);

    await user.click(screen.getByText('Select tag'));
    jest.advanceTimersByTime(1000);
    await user.click(screen.getByText('http.method'));
    jest.advanceTimersByTime(1000);
    expect(screen.getAllByLabelText('Add tag').length).toBe(1);
    expect(screen.getAllByLabelText(/Remove tag/).length).toBe(1);

    await user.click(screen.getByLabelText('Add tag'));
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the new tag, so no need to add another one
    expect(screen.getAllByLabelText(/Remove tag/).length).toBe(2); // one for each tag

    await user.click(screen.getAllByLabelText(/Remove tag/)[1]);
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(1); // filled in the default tag, so can add another one
    expect(screen.queryAllByLabelText(/Remove tag/).length).toBe(1); // filled in the default tag, so can remove values

    await user.click(screen.getAllByLabelText(/Remove tag/)[0]);
    jest.advanceTimersByTime(1000);
    expect(screen.queryAllByLabelText('Add tag').length).toBe(0); // not filled in the default tag, so no need to add another one
    expect(screen.queryAllByLabelText(/Remove tag/).length).toBe(0); // mot filled in the default tag, so no values to remove
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

  it('should allow selecting template variables', async () => {
    const { container } = render(
      <GroupByField
        datasource={datasource}
        query={query}
        onChange={onChange}
        isTagsLoading={false}
        addVariablesToOptions={true}
      />
    );

    const tagSelect = container.querySelector(`input[aria-label="Select tag for filter 1"]`);
    expect(tagSelect).not.toBeNull();
    expect(tagSelect).toBeInTheDocument();

    if (tagSelect) {
      await user.click(tagSelect);
      jest.advanceTimersByTime(1000);
      expect(await screen.findByText('$templateVariable1')).toBeInTheDocument();
      expect(await screen.findByText('$templateVariable2')).toBeInTheDocument();
    }
  });
});
