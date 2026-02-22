import { css } from '@emotion/css';
import { useEffect, useMemo, useRef, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { AdHocFiltersVariable, EmbeddedScene, SceneFlexLayout, SceneVariableSet } from '@grafana/scenes';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { Silence } from 'app/plugins/datasource/alertmanager/types';

import { prometheusExpressionBuilder } from '../../triage/scene/expressionBuilder';
import { matcherToOperator } from '../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';

interface SilencesFilterProps {
  silences: Silence[];
}

export function SilencesFilter({ silences }: SilencesFilterProps) {
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
  const styles = useStyles2(getStyles);

  const silencesRef = useRef(silences);
  silencesRef.current = silences;

  const [labelsVariable] = useState(() => {
    const initialFilters = parsePromQLStyleMatcherLooseSafe(queryString ?? '').map((m) => ({
      key: m.name,
      operator: matcherToOperator(m),
      value: m.value,
    }));

    return new AdHocFiltersVariable({
      name: 'silenceLabelsFilter',
      allowCustomValue: true,
      layout: 'combobox',
      applyMode: 'manual',
      expressionBuilder: prometheusExpressionBuilder,
      inputPlaceholder: 'Search by matchers',
      filters: initialFilters,
      getTagKeysProvider: () => {
        const keys = new Set<string>();
        for (const silence of silencesRef.current) {
          for (const matcher of silence.matchers ?? []) {
            keys.add(matcher.name);
          }
        }
        return Promise.resolve({
          replace: true,
          values: Array.from(keys).map((k) => ({ text: k, value: k })),
        });
      },
      getTagValuesProvider: (_variable, filter) => {
        const values = new Set<string>();
        for (const silence of silencesRef.current) {
          for (const matcher of silence.matchers ?? []) {
            if (matcher.name === filter.key) {
              values.add(matcher.value);
            }
          }
        }
        return Promise.resolve({
          replace: true,
          values: Array.from(values).map((v) => ({ text: v, value: v })),
        });
      },
    });
  });

  const scene = useMemo(
    () =>
      new EmbeddedScene({
        $variables: new SceneVariableSet({ variables: [labelsVariable] }),
        body: new SceneFlexLayout({ children: [] }),
      }),
    [labelsVariable]
  );

  useEffect(() => {
    const deactivate = scene.activate();
    return () => deactivate();
  }, [scene]);

  useEffect(() => {
    const sub = labelsVariable.subscribeToState((newState) => {
      const expr = prometheusExpressionBuilder(newState.filters);
      setQueryParams({ queryString: expr || null });
    });
    return () => sub.unsubscribe();
  }, [labelsVariable, setQueryParams]);

  const hasFilters = Boolean(queryString);

  const clearFilters = () => {
    labelsVariable.setState({ filters: [] });
    setQueryParams({ silenceState: null });
  };

  return (
    <Stack direction="row" alignItems="center" wrap="wrap">
      <div className={styles.comboboxWrapper}>
        <labelsVariable.Component model={labelsVariable} />
      </div>
      {hasFilters && (
        <Button variant="secondary" icon="times" onClick={clearFilters}>
          <Trans i18nKey="alerting.common.clear-filters">Clear filters</Trans>
        </Button>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  comboboxWrapper: css({
    minWidth: '360px',
  }),
});
