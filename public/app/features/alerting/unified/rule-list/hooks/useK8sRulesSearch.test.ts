import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { getWrapper } from 'test/test-utils';

import { setupMswServer } from 'app/features/alerting/unified/mockApi';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import {
  alertRuleHitFactory,
  recordingRuleHitFactory,
} from 'app/features/alerting/unified/mocks/server/entities/k8s/ruleSearchHits';
import {
  RULES_ALERTING_API_SERVER_BASE_URL,
  rulesSearchHandlerFor,
} from 'app/features/alerting/unified/mocks/server/handlers/k8s/rulesSearch.k8s';
import { getSearchFilterFromQuery } from 'app/features/alerting/unified/search/rulesSearchParser';
import { setupDataSources } from 'app/features/alerting/unified/testSetup/datasources';

import { buildSearchArgs, useK8sRulesSearch } from './useK8sRulesSearch';

const server = setupMswServer();
const wrapper = () => getWrapper({ renderWithRouter: true });

const emptyFilter = getSearchFilterFromQuery('');

describe('buildSearchArgs', () => {
  it('maps free-text and rule name terms to q', () => {
    const filter = getSearchFilterFromQuery('rule:"my rule" some words');
    const args = buildSearchArgs(filter);

    expect(args.q).toBe('some words my rule');
  });

  it('maps labels through unchanged', () => {
    const filter = getSearchFilterFromQuery('label:severity=critical');
    const args = buildSearchArgs(filter);

    expect(args.labels).toEqual(['severity=critical']);
  });

  it('maps group name to a single-element groups array', () => {
    const filter = getSearchFilterFromQuery('group:my-group');
    const args = buildSearchArgs(filter);

    expect(args.groups).toEqual(['my-group']);
  });

  it('maps alerting/recording rule type to alertrule/recordingrule', () => {
    expect(buildSearchArgs(getSearchFilterFromQuery('type:alerting')).type).toBe('alertrule');
    expect(buildSearchArgs(getSearchFilterFromQuery('type:recording')).type).toBe('recordingrule');
  });

  it('maps contact point to receiver', () => {
    const filter = getSearchFilterFromQuery('contactPoint:my-contact-point');
    const args = buildSearchArgs(filter);

    expect(args.receiver).toBe('my-contact-point');
  });

  it('maps dashboard uid through unchanged', () => {
    const filter = getSearchFilterFromQuery('dashboard:my-dashboard-uid');
    const args = buildSearchArgs(filter);

    expect(args.dashboardUid).toBe('my-dashboard-uid');
  });

  it('maps notification policy to routingTree', () => {
    const filter = getSearchFilterFromQuery('policy:team-a-policy');
    const args = buildSearchArgs(filter);

    expect(args.routingTree).toBe('team-a-policy');
  });

  it('maps the hide-plugin-rules filter to a not-exists label matcher', () => {
    const filter = getSearchFilterFromQuery('plugins:hide label:severity=critical');
    const args = buildSearchArgs(filter);

    expect(args.labels).toEqual(['severity=critical', '!__grafana_origin']);
  });

  it('resolves datasource names to uids for datasourceUiDs, skipping unknown names', () => {
    setupDataSources(mockDataSource({ name: 'Prometheus', uid: 'prometheus-uid' }));

    const filter = getSearchFilterFromQuery('datasource:Prometheus datasource:Deleted');
    const args = buildSearchArgs(filter);

    expect(args.datasourceUiDs).toEqual(['prometheus-uid']);
  });

  it('always sorts by title and forwards the page size as limit', () => {
    const args = buildSearchArgs(emptyFilter, 10);

    expect(args.sort).toBe('title');
    expect(args.limit).toBe('10');
  });

  it('leaves unset fields undefined for an empty filter', () => {
    const args = buildSearchArgs(emptyFilter);

    expect(args.q).toBeUndefined();
    expect(args.labels).toBeUndefined();
    expect(args.groups).toBeUndefined();
    expect(args.type).toBeUndefined();
    expect(args.receiver).toBeUndefined();
    expect(args.routingTree).toBeUndefined();
    expect(args.dashboardUid).toBeUndefined();
    expect(args.datasourceUiDs).toBeUndefined();
  });
});

describe('useK8sRulesSearch', () => {
  it('loads the first page of hits', async () => {
    server.use(rulesSearchHandlerFor([alertRuleHitFactory.build(), recordingRuleHitFactory.build()]));

    const { result } = renderHook(() => useK8sRulesSearch(emptyFilter, 24), { wrapper: wrapper() });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.hits).toHaveLength(2);
    expect(result.current.hasMore).toBe(false);
  });

  it('paginates via loadMore using the continuation token', async () => {
    const hits = alertRuleHitFactory.buildList(5);
    server.use(rulesSearchHandlerFor(hits));

    const { result } = renderHook(() => useK8sRulesSearch(emptyFilter, 2), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hits).toHaveLength(2);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hits).toHaveLength(4);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hits).toHaveLength(5);
    expect(result.current.hasMore).toBe(false);
  });

  it('resets accumulated hits when the filter changes', async () => {
    server.use(
      rulesSearchHandlerFor([
        alertRuleHitFactory.build({ title: 'Wanted rule' }),
        alertRuleHitFactory.build({ title: 'Some other rule' }),
      ])
    );

    const { result, rerender } = renderHook(({ filter }) => useK8sRulesSearch(filter, 24), {
      wrapper: wrapper(),
      initialProps: { filter: emptyFilter },
    });

    await waitFor(() => expect(result.current.hits).toHaveLength(2));

    const newFilter = getSearchFilterFromQuery('rule:wanted');
    rerender({ filter: newFilter });

    await waitFor(() => expect(result.current.hits).toHaveLength(1));
    expect(result.current.hits[0].title).toBe('Wanted rule');
  });

  it('forwards the free-text filter to the mock, which narrows the response server-side', async () => {
    server.use(
      rulesSearchHandlerFor([
        alertRuleHitFactory.build({ title: 'CPU usage high' }),
        recordingRuleHitFactory.build({ title: 'Memory usage average' }),
      ])
    );

    const filter = getSearchFilterFromQuery('rule:memory');
    const { result } = renderHook(() => useK8sRulesSearch(filter, 24), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hits).toHaveLength(1);
    expect(result.current.hits[0].title).toBe('Memory usage average');
  });

  it('forwards the label filter to the mock, which applies key=value matching', async () => {
    server.use(
      rulesSearchHandlerFor([
        alertRuleHitFactory.build({ title: 'Critical rule', labels: { severity: 'critical' } }),
        alertRuleHitFactory.build({ title: 'Warning rule', labels: { severity: 'warning' } }),
      ])
    );

    const filter = getSearchFilterFromQuery('label:severity=critical');
    const { result } = renderHook(() => useK8sRulesSearch(filter, 24), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hits).toHaveLength(1);
    expect(result.current.hits[0].title).toBe('Critical rule');
  });

  it('surfaces request errors and stops paginating', async () => {
    server.use(
      http.get(`${RULES_ALERTING_API_SERVER_BASE_URL}/namespaces/:namespace/search`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useK8sRulesSearch(emptyFilter, 24), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeDefined();
    expect(result.current.hits).toHaveLength(0);
    expect(result.current.hasMore).toBe(false);
  });
});
