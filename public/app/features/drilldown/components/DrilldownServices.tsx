import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Button, Combobox, type ComboboxOption, Stack, Text, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';

import {
  type Scope,
  type ScopeType,
  SCOPE_VALUES,
  type ServiceSummary,
  TREND_MAX,
  YOUR_SERVICES,
} from '../mockScenario';

import { TrendSparkline } from './TrendSparkline';

interface Props {
  onPick: (scope: Scope) => void;
}

// Scope without a hint or a question: a service you know, or any service, environment or namespace.
export function DrilldownServices({ onPick }: Props) {
  const styles = useStyles2(getStyles);
  const [browsing, setBrowsing] = useState(false);
  const [scopeType, setScopeType] = useState<ScopeType>('service');

  const scopeTypeOptions: Array<ComboboxOption<ScopeType>> = [
    { value: 'service', label: t('drilldown-page.services.scope-service', 'Service') },
    { value: 'environment', label: t('drilldown-page.services.scope-environment', 'Environment') },
    { value: 'namespace', label: t('drilldown-page.services.scope-namespace', 'Namespace') },
  ];

  return (
    <section className={styles.section} aria-labelledby="drilldown-services-title">
      <Stack alignItems="center" wrap="wrap" gap={2}>
        <Text element="h2" variant="h3" id="drilldown-services-title">
          {t('drilldown-page.services.title', 'Your services')}
        </Text>
        {browsing ? (
          <Stack gap={1} alignItems="center">
            <Combobox
              width={18}
              options={scopeTypeOptions}
              value={scopeType}
              aria-label={t('drilldown-page.services.scope-type-label', 'Scope type')}
              onChange={(option) => setScopeType(option.value)}
            />
            <Combobox
              width={24}
              options={SCOPE_VALUES[scopeType].map((value) => ({ value }))}
              value={null}
              placeholder={t('drilldown-page.services.scope-value-placeholder', 'Pick a value')}
              aria-label={t('drilldown-page.services.scope-value-label', 'Scope value')}
              onChange={(option) => onPick({ type: scopeType, value: option.value })}
            />
          </Stack>
        ) : (
          <Button size="sm" variant="secondary" icon="search" onClick={() => setBrowsing(true)}>
            {t('drilldown-page.services.browse', 'Browse all services')}
          </Button>
        )}
      </Stack>
      <div className={styles.grid}>
        {YOUR_SERVICES.map((service) => (
          <ServiceCard
            key={service.name}
            service={service}
            onClick={() => onPick({ type: 'service', value: service.name })}
          />
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ service, onClick }: { service: ServiceSummary; onClick: () => void }) {
  const styles = useStyles2(getStyles);
  const degraded = service.health === 'degraded';

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.cardHead}>
        <Text weight="medium">{service.name}</Text>
        <Badge
          color={degraded ? 'red' : 'green'}
          text={
            degraded
              ? t('drilldown-page.services.degraded', 'Degraded')
              : t('drilldown-page.services.healthy', 'Healthy')
          }
        />
      </span>
      <span className={styles.stats}>
        <Stat label={t('drilldown-page.services.p95', 'p95')} value={service.p95} alert={degraded} />
        <Stat label={t('drilldown-page.services.errors', 'Errors')} value={service.errorRate} alert={degraded} />
      </span>
      <TrendSparkline values={service.trend} color={degraded ? 'red' : 'green'} height={28} max={TREND_MAX} />
      <Text variant="bodySmall" color="secondary">
        {t('drilldown-page.services.last-deploy', 'Last deploy {{deploy}}', { deploy: service.lastDeploy })}
      </Text>
    </button>
  );
}

function Stat({ label, value, alert }: { label: string; value: string; alert: boolean }) {
  return (
    <span>
      <Text variant="bodySmall" color="secondary">
        {label}{' '}
      </Text>
      <Text variant="body" weight="medium" color={alert ? 'error' : 'primary'}>
        {value}
      </Text>
    </span>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  section: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  grid: css({
    display: 'grid',
    gap: theme.spacing(2),
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  }),
  card: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2),
    textAlign: 'left',
    color: 'inherit',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    cursor: 'pointer',
    '&:hover': {
      borderColor: theme.colors.border.strong,
    },
    '&:focus-visible': getFocusStyles(theme),
  }),
  cardHead: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  stats: css({
    display: 'flex',
    gap: theme.spacing(2),
  }),
});
