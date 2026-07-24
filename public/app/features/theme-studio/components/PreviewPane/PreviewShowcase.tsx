import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Combobox,
  type ComboboxOption,
  Field,
  Input,
  LinkButton,
  RadioButtonGroup,
  Stack,
  Switch,
  TagList,
  Text,
  TextLink,
  useStyles2,
} from '@grafana/ui';

const radioOptions = [
  { label: 'Graph', value: 'graph' },
  { label: 'Table', value: 'table' },
  { label: 'Logs', value: 'logs' },
];

const comboOptions: Array<ComboboxOption<string>> = [
  { label: 'Last 5 minutes', value: '5m' },
  { label: 'Last 15 minutes', value: '15m' },
  { label: 'Last 1 hour', value: '1h' },
];

/**
 * Real Grafana components rendered under the parent's derived ThemeContext, so the full range of
 * theme fields (buttons, inputs, alerts, badges, links, text, borders) is represented.
 */
export const PreviewShowcase = () => {
  const styles = useStyles2(getStyles);
  const [view, setView] = useState('graph');
  const [enabled, setEnabled] = useState(true);
  const [checked, setChecked] = useState(true);
  const [range, setRange] = useState('15m');

  return (
    <div className={styles.grid}>
      <Card noMargin>
        <Card.Heading>{t('theme-studio.showcase.actions', 'Actions')}</Card.Heading>
        <Card.Description>
          <Stack direction="column" gap={2}>
            <Stack direction="row" gap={1} wrap="wrap">
              <Button variant="primary">{t('theme-studio.showcase.primary', 'Primary')}</Button>
              <Button variant="secondary">{t('theme-studio.showcase.secondary', 'Secondary')}</Button>
              <Button variant="destructive">{t('theme-studio.showcase.destructive', 'Delete')}</Button>
              <Button variant="primary" disabled>
                {t('theme-studio.showcase.disabled', 'Disabled')}
              </Button>
            </Stack>
            <Stack direction="row" gap={1} wrap="wrap">
              <LinkButton variant="secondary" fill="outline" href="#" icon="external-link-alt">
                {t('theme-studio.showcase.link-button', 'Docs')}
              </LinkButton>
              <Button variant="success" fill="text" icon="check">
                {t('theme-studio.showcase.text-button', 'Apply')}
              </Button>
            </Stack>
          </Stack>
        </Card.Description>
      </Card>

      <Card noMargin>
        <Card.Heading>{t('theme-studio.showcase.form', 'Form controls')}</Card.Heading>
        <Card.Description>
          <Stack direction="column" gap={1}>
            <Field noMargin label={t('theme-studio.showcase.query-name', 'Query name')}>
              <Input placeholder={t('theme-studio.showcase.query-placeholder', 'requests_per_second')} />
            </Field>
            <Field noMargin label={t('theme-studio.showcase.time-range', 'Time range')}>
              <Combobox options={comboOptions} value={range} onChange={(o) => setRange(o.value)} />
            </Field>
            <Field noMargin label={t('theme-studio.showcase.view-mode', 'View mode')}>
              <RadioButtonGroup options={radioOptions} value={view} onChange={(v) => setView(v ?? 'graph')} />
            </Field>
            <Stack direction="row" gap={2} alignItems="center">
              <Switch value={enabled} onChange={() => setEnabled((v) => !v)} />
              <Text variant="bodySmall">{t('theme-studio.showcase.live', 'Live updates')}</Text>
              <Checkbox
                value={checked}
                onChange={() => setChecked((v) => !v)}
                label={t('theme-studio.showcase.stacking', 'Stacking')}
              />
            </Stack>
          </Stack>
        </Card.Description>
      </Card>

      <Card noMargin>
        <Card.Heading>{t('theme-studio.showcase.notifications', 'Notifications')}</Card.Heading>
        <Card.Description>
          <Stack direction="column" gap={1}>
            <Alert severity="error" title={t('theme-studio.showcase.alert-error', 'Datasource unreachable')} />
            <Alert severity="warning" title={t('theme-studio.showcase.alert-warning', 'High query latency')} />
            <Alert severity="success" title={t('theme-studio.showcase.alert-success', 'Rule saved')} />
            <Alert severity="info" title={t('theme-studio.showcase.alert-info', 'New version available')} />
          </Stack>
        </Card.Description>
      </Card>

      <Card noMargin>
        <Card.Heading>{t('theme-studio.showcase.status', 'Badges, tags & text')}</Card.Heading>
        <Card.Description>
          <Stack direction="column" gap={2}>
            <Stack direction="row" gap={1} wrap="wrap">
              <Badge color="green" icon="check-circle" text={t('theme-studio.showcase.badge-ok', 'Healthy')} />
              <Badge
                color="orange"
                icon="exclamation-triangle"
                text={t('theme-studio.showcase.badge-warn', 'Degraded')}
              />
              <Badge color="red" icon="times-circle" text={t('theme-studio.showcase.badge-error', 'Down')} />
              <Badge color="blue" icon="info-circle" text={t('theme-studio.showcase.badge-info', 'Info')} />
            </Stack>
            <TagList tags={['prometheus', 'production', 'team-a', 'latency']} />
            <Stack direction="column" gap={0}>
              <Text>{t('theme-studio.showcase.text-primary', 'Primary text on the panel surface.')}</Text>
              <Text color="secondary" variant="bodySmall">
                {t('theme-studio.showcase.text-secondary', 'Secondary text for supporting details.')}
              </Text>
              <Text color="disabled" variant="bodySmall">
                {t('theme-studio.showcase.text-disabled', 'Disabled text.')}
              </Text>
              <TextLink href="#" external>
                {t('theme-studio.showcase.text-link', 'A themed link')}
              </TextLink>
            </Stack>
          </Stack>
        </Card.Description>
      </Card>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  grid: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: theme.spacing(2),
    marginTop: theme.spacing(2),
  }),
});
