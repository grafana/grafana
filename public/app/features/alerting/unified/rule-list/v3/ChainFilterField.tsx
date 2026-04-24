import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Combobox, Label, useStyles2 } from '@grafana/ui';

import { useListChainsQuery } from '../../api/chainsApi';

interface ChainFilterFieldProps {
  value?: string;
  onChange: (next?: string) => void;
}

/**
 * V3-only filter field: narrows the rule list to rules in a specific
 * evaluation chain. Gated on the `alerting.rulesAPIV2` feature toggle via
 * the parent page; no toggle check is repeated here.
 */
export function ChainFilterField({ value, onChange }: ChainFilterFieldProps) {
  const { data: chains = [] } = useListChainsQuery();
  const styles = useStyles2(getStyles);

  const options = useMemo(() => {
    const allChains = { value: '', label: t('alerting.rule-list-v3.filter.all-chains', 'All chains') };
    return [allChains, ...chains.map((chain) => ({ value: chain.id, label: chain.name }))];
  }, [chains]);

  return (
    <div className={styles.field}>
      <Label>{t('alerting.rule-list-v3.filter.chain-label', 'Evaluation chain')}</Label>
      <Combobox
        value={value ?? ''}
        options={options}
        onChange={(selected) => onChange(selected?.value ? selected.value : undefined)}
      />
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    field: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      padding: theme.spacing(0, 1),
    }),
  };
}
