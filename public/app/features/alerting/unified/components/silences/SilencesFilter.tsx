import { css } from '@emotion/css';
import { isEqual } from 'lodash';
import { useCallback, useMemo, useRef, useState } from 'react';

import { type GrafanaTheme2, type SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { type AdHocFilterWithLabels, AdHocFiltersComboboxRenderer, type AdHocFiltersController } from '@grafana/scenes';
import { Icon, Stack, Tooltip } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
import { useQueryParams } from 'app/core/hooks/useQueryParams';
import { type Silence } from 'app/plugins/datasource/alertmanager/types';

import { prometheusExpressionBuilder } from '../../triage/scene/expressionBuilder';
import { matcherToOperator } from '../../utils/alertmanager';
import { parsePromQLStyleMatcherLooseSafe } from '../../utils/matchers';
import { getSilenceFiltersFromUrlParams } from '../../utils/misc';

function getSilenceMatcherOperators(): Array<SelectableValue<string>> {
  return [
    { label: '=', value: '=', description: t('alerting.silences.operator.equals', 'Equals') },
    { label: '!=', value: '!=', description: t('alerting.silences.operator.not-equal', 'Not equal') },
    { label: '=~', value: '=~', description: t('alerting.silences.operator.matches-regex', 'Matches regex') },
    {
      label: '!~',
      value: '!~',
      description: t('alerting.silences.operator.not-matches-regex', 'Does not match regex'),
    },
  ];
}

interface SilencesFilterProps {
  silences: Silence[];
}

export function SilencesFilter({ silences }: SilencesFilterProps) {
  const [queryParams, setQueryParams] = useQueryParams();
  const { queryString } = getSilenceFiltersFromUrlParams(queryParams);
  const styles = useStyles2(getStyles);

  const silencesRef = useRef(silences);
  silencesRef.current = silences;

  const [filters, setFilters] = useState<AdHocFilterWithLabels[]>(() =>
    parsePromQLStyleMatcherLooseSafe(queryString ?? '').map((m) => ({
      key: m.name,
      operator: matcherToOperator(m),
      value: m.value,
    }))
  );
  const [wip, setWip] = useState<AdHocFilterWithLabels | undefined>({ key: '', operator: '=', value: '' });

  const updateQueryString = useCallback(
    (newFilters: AdHocFilterWithLabels[]) => {
      const expr = prometheusExpressionBuilder(newFilters);
      setQueryParams({ queryString: expr || null });
    },
    [setQueryParams]
  );

  const controller = useMemo(
    () => new SilenceFiltersController(silencesRef, filters, setFilters, updateQueryString, wip, setWip),
    [silencesRef, filters, updateQueryString, wip]
  );

  return (
    <Stack direction="row" alignItems="center" wrap="wrap">
      <div className={styles.comboboxWrapper}>
        <AdHocFiltersComboboxRenderer controller={controller} />
      </div>
      <Tooltip
        content={
          <div>
            <p>
              <Trans i18nKey="alerting.silences.filter.tooltip-description">
                Find silences by matcher. Matches label name, value, and operator exactly.
              </Trans>
            </p>
            <p>
              <Trans i18nKey="alerting.silences.filter.tooltip-example">
                Example: <code>env=~&quot;prod.*&quot;</code> finds silences with an{' '}
                <code>env=~&quot;prod.*&quot;</code> matcher.
              </Trans>
            </p>
          </div>
        }
      >
        <Icon name="info-circle" size="sm" />
      </Tooltip>
    </Stack>
  );
}

export class SilenceFiltersController implements AdHocFiltersController {
  private silencesRef: React.RefObject<Silence[]>;
  private filters: AdHocFilterWithLabels[];
  private setFilters: (filters: AdHocFilterWithLabels[]) => void;
  private updateQueryString: (filters: AdHocFilterWithLabels[]) => void;
  private wip: AdHocFilterWithLabels | undefined;
  private setWip: (wip: AdHocFilterWithLabels | undefined) => void;

  constructor(
    silencesRef: React.RefObject<Silence[]>,
    filters: AdHocFilterWithLabels[],
    setFilters: (filters: AdHocFilterWithLabels[]) => void,
    updateQueryString: (filters: AdHocFilterWithLabels[]) => void,
    wip: AdHocFilterWithLabels | undefined,
    setWip: (wip: AdHocFilterWithLabels | undefined) => void
  ) {
    this.silencesRef = silencesRef;
    this.filters = filters;
    this.setFilters = setFilters;
    this.updateQueryString = updateQueryString;
    this.wip = wip;
    this.setWip = setWip;
  }

  useState() {
    return {
      filters: this.filters,
      readOnly: false,
      allowCustomValue: true,
      supportsMultiValueOperators: false,
      wip: this.wip,
      inputPlaceholder: t('alerting.silences.filter.search-by-matchers', 'Search by matchers'),
    };
  }

  async getKeys(_currentKey: string | null): Promise<Array<SelectableValue<string>>> {
    const keys = new Set<string>();
    for (const silence of this.silencesRef.current ?? []) {
      for (const matcher of silence.matchers ?? []) {
        keys.add(matcher.name);
      }
    }
    return Array.from(keys).map((k) => ({ label: k, value: k }));
  }

  async getValuesFor(filter: AdHocFilterWithLabels): Promise<Array<SelectableValue<string>>> {
    const values = new Set<string>();
    for (const silence of this.silencesRef.current ?? []) {
      for (const matcher of silence.matchers ?? []) {
        if (matcher.name === filter.key) {
          values.add(matcher.value);
        }
      }
    }
    return Array.from(values).map((v) => ({ label: v, value: v }));
  }

  getOperators(): Array<SelectableValue<string>> {
    return getSilenceMatcherOperators();
  }

  updateFilter(filter: AdHocFilterWithLabels, update: Partial<AdHocFilterWithLabels>): void {
    if (filter === this.wip) {
      if ('value' in update && update.value !== '') {
        const newFilters = [...this.filters, { ...this.wip, ...update }];
        this.setFilters(newFilters);
        this.updateQueryString(newFilters);
        this.setWip(undefined);
      } else {
        this.setWip({ ...this.wip, ...update });
      }
      return;
    }

    const newFilters = this.filters.map((f) => (isEqual(f, filter) ? { ...f, ...update } : f));
    this.setFilters(newFilters);
    this.updateQueryString(newFilters);
  }

  updateFilters(filters: AdHocFilterWithLabels[]): void {
    this.setFilters(filters);
    this.updateQueryString(filters);
  }

  removeFilter(filter: AdHocFilterWithLabels): void {
    const newFilters = this.filters.filter((f) => !isEqual(f, filter));
    this.setFilters(newFilters);
    this.updateQueryString(newFilters);
  }

  removeLastFilter(): void {
    if (this.filters.length > 0) {
      const newFilters = this.filters.slice(0, -1);
      this.setFilters(newFilters);
      this.updateQueryString(newFilters);
    }
  }

  handleComboboxBackspace(filter: AdHocFilterWithLabels): void {
    const index = this.filters.findIndex((f) => isEqual(f, filter));
    if (index > 0) {
      const newFilters = this.filters.map((f, i) => ({
        ...f,
        forceEdit: i === index - 1,
      }));
      this.setFilters(newFilters);
    }
  }

  addWip(): void {
    this.setWip({ key: '', operator: '=', value: '' });
  }

  updateToMatchAll(filter: AdHocFilterWithLabels): void {
    this.updateFilter(filter, { operator: '=~', value: '.*', matchAllFilter: true });
  }

  restoreOriginalFilter(): void {}

  clearAll(): void {
    this.setFilters([]);
    this.setWip({ key: '', operator: '=', value: '' });
    this.updateQueryString([]);
  }
}

const getStyles = (theme: GrafanaTheme2) => ({
  comboboxWrapper: css({
    minWidth: '360px',
  }),
});
