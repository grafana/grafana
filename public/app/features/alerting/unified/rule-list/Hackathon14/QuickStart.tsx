import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Box, Button, Card, Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';
import { HackathonTable, TableColumn } from 'app/features/browse-dashboards/hackathon14/HackathonTable';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';

type QuickStartRow = {
  uid: string;
  title: string;
  folderTitle: string;
  state: string;
  message: string;
  severity: string;
};

type QuickAction = {
  icon: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryIcon: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export const QuickStart = () => {
  const styles = useStyles2(getStyles);

  const { data: ruleNamespaces = [], isLoading } = alertRuleApi.usePrometheusRuleNamespacesQuery({
    ruleSourceName: 'grafana',
    limitAlerts: 1,
    maxGroups: 25,
    excludeAlerts: false,
  });

  const rows: QuickStartRow[] = ruleNamespaces.flatMap((namespace) =>
    namespace.groups.flatMap((group) =>
      group.rules.map((rule) => ({
        uid: rule.uid ?? `${namespace.name}-${group.name}-${rule.name}`,
        title: rule.name,
        folderTitle: namespace.folderTitle ?? namespace.name,
        state: rule.state ?? 'unknown',
        message: rule.annotations?.summary || rule.annotations?.description || '—',
        severity: rule.labels?.severity ?? 'unknown',
      }))
    )
  );

  const columns: TableColumn<QuickStartRow>[] = [
    {
      key: 'name',
      header: 'Alert name',
      width: '2.2fr',
      render: (alert) => (
        <Stack direction="column" gap={0.5} className={styles.cellContent}>
          <Text weight="medium" className={styles.truncate}>
            {alert.title}
          </Text>
          <Text variant="bodySmall" color="secondary" className={styles.truncate}>
            {alert.message}
          </Text>
        </Stack>
      ),
    },
    {
      key: 'folder',
      header: 'Folder / Group',
      width: '1.6fr',
      render: (alert) => (
        <Text variant="bodySmall" color="secondary" className={styles.truncate}>
          {alert.folderTitle}
        </Text>
      ),
    },
    {
      key: 'state',
      header: 'State',
      width: '140px',
      render: (alert) => <span className={styles.getStateBadge(alert.state)}>{alert.state}</span>,
    },
    {
      key: 'severity',
      header: 'Severity',
      width: '120px',
      render: (alert) => <span className={styles.getSeverityBadge(alert.severity)}>{alert.severity}</span>,
    },
  ];

  const handleViewAlerts = () => {
    window.location.href = '/alerting/list/hackathon14/view-all-alerts';
  };

  const handleCreateAlert = () => {
    window.location.href = '/alerting/new';
  };

  const handleCardPrimary = (event: React.MouseEvent, action: QuickAction['onPrimary']) => {
    event.stopPropagation();
    action();
  };

  const handleCardSecondary = (event: React.MouseEvent, action?: QuickAction['onSecondary']) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <div>
      <Stack direction="column" gap={3}>
        <Stack direction="column" gap={2}>
          <Stack direction="row" gap={1.5} alignItems="center" className={styles.heroHeader}>
            <span className={styles.heroIconWrapper}>
              <Icon name="radar" size="xl" />
            </span>

            <BrowsingSectionTitle
              title="Jump-start your alerting workspace"
              subtitle="Discover high-signal rules already running in this Grafana stack and explore the next steps that keep
                your team informed."
              icon="lightbulb"
            />
          </Stack>

          <Stack direction="row" gap={2} wrap className={styles.actionGrid}>
            <Stack gap={2}>
              {quickActions.map((action) => (
                <Card
                  key={action.title}
                  className={styles.actionCard}
                  role="button"
                  tabIndex={0}
                  onClick={action.onPrimary}
                >
                  <Stack direction="row" gap={1.5} alignItems="flex-start">
                    <span className={styles.actionIcon}>
                      <Icon name={action.icon} />
                    </span>
                    <Stack gap={0.75}>
                      {/* title */}
                      <Stack gap={0.25} direction="column">
                        <Text weight="medium">{action.title}</Text>
                        <div className={styles.description}>
                            <Text variant="bodySmall" color="secondary">
                            {action.description}
                            </Text>
                        </div>

                        <Stack direction="column" gap={0.75} alignItems="center" className={styles.cardFooter}>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={action.primaryIcon}
                            onClick={(event) => handleCardPrimary(event, action.onPrimary)}
                            style={{ marginRight: '4px' }}
                          >
                            {action.primaryLabel}
                          </Button>
                          {action.secondaryLabel && (
                            <TextLink
                              className={styles.secondaryLink}
                              onClick={(event) => handleCardSecondary(event, action.onSecondary)}
                            >
                              {action.secondaryLabel}
                            </TextLink>
                          )}
                        </Stack>
                      </Stack>
                    </Stack>
                  </Stack>
                </Card>
              ))}
            </Stack>
          </Stack>
        </Stack>

        <Stack direction="column" gap={1.5}>
          <BrowsingSectionTitle
            title="Live alert rules in Grafana Prometheus"
            subtitle="Every row below comes directly from <code>/api/prometheus/grafana/api/v1/rules</code>. Click a rule to open
            its full detail page."
            icon="lightbulb"
          />
        </Stack>

        <HackathonTable
          data={rows.length > 0 ? rows : []}
          columns={columns}
          isLoading={isLoading}
          emptyMessage="No alert rules found yet"
          onRowClick={(row) => window.location.assign(`/alerting/grafana/${row.uid}/view`)}
        />

        <Stack direction="row" gap={1.5} wrap>
          <Button icon="plus" variant="primary" onClick={handleCreateAlert}>
            Create alert rule
          </Button>
          <Button icon="list-ul" variant="secondary" onClick={handleViewAlerts}>
            Browse all alerts
          </Button>
          <Button
            icon="book"
            variant="secondary"
            onClick={() => window.open('https://grafana.com/docs/grafana/latest/alerting/', '_blank')}
          >
            Read alerting guide
          </Button>
        </Stack>
      </Stack>
    </div>
  );
};

const quickActions: QuickAction[] = [
  {
    icon: 'ai',
    title: 'Use AI to draft a rule',
    description: 'Let Grafana turn plain-language intent into a ready-to-edit alert definition in seconds.',
    primaryLabel: 'Launch AI builder',
    primaryIcon: 'wand',
    onPrimary: () => window.location.assign('/alerting/new/alerting?open=genai'),
    secondaryLabel: 'How it works',
    onSecondary: () => window.open('https://grafana.com/docs/grafana/latest/alerting/gen-ai/', '_blank'),
  },
  {
    icon: 'share-alt',
    title: 'Add a notification route',
    description: 'Wire alerts into Slack, PagerDuty, or email so responders hear about incidents instantly.',
    primaryLabel: 'Manage routes',
    primaryIcon: 'envelope',
    onPrimary: () => window.location.assign('/alerting/routes'),
    secondaryLabel: 'See integrations',
    onSecondary: () => window.open('https://grafana.com/docs/grafana/latest/alerting/fundamentals/routes/', '_blank'),
  },
  {
    icon: 'users-alt',
    title: 'Invite teammates to collaborate',
    description: 'Share ownership of rules, escalation policies, and dashboards with the rest of your organization.',
    primaryLabel: 'Invite users',
    primaryIcon: 'user-plus',
    onPrimary: () => window.location.assign('/org/users'),
    secondaryLabel: 'Set permissions',
    onSecondary: () =>
      window.open('https://grafana.com/docs/grafana/latest/administration/manage-users-and-permissions/', '_blank'),
  },
];

const getStyles = (theme: GrafanaTheme2) => ({
    description: css({
        height: '75px',
    }),
  container: css({
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.lg,
    padding: theme.spacing(3),
    background: theme.colors.background.primary,
    boxShadow: `0 18px 44px -28px ${theme.colors.primary.shade}`,
  }),

  cellContent: css({
    maxWidth: '100%',
  }),

  truncate: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  maxWidthText: css({
    maxWidth: 520,
  }),

  getStateBadge: (state: string) =>
    css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0.5, 1.5),
      borderRadius: theme.shape.radius.sm,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'capitalize',
      background:
        state.toLowerCase() === 'firing'
          ? 'rgba(220, 38, 38, 0.12)'
          : state.toLowerCase() === 'pending'
            ? 'rgba(249, 115, 22, 0.12)'
            : 'rgba(14, 165, 233, 0.12)',
      color:
        state.toLowerCase() === 'firing'
          ? theme.colors.error.main
          : state.toLowerCase() === 'pending'
            ? theme.colors.warning.main
            : theme.colors.primary.main,
    }),

  getSeverityBadge: (severity: string) =>
    css({
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: theme.spacing(0.5, 1.5),
      borderRadius: theme.shape.radius.sm,
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.fontWeightMedium,
      textTransform: 'capitalize',
      background:
        severity.toLowerCase() === 'critical'
          ? 'rgba(220, 38, 38, 0.12)'
          : severity.toLowerCase() === 'warning'
            ? 'rgba(249, 115, 22, 0.12)'
            : 'rgba(59, 130, 246, 0.12)',
      color:
        severity.toLowerCase() === 'critical'
          ? theme.colors.error.main
          : severity.toLowerCase() === 'warning'
            ? theme.colors.warning.main
            : theme.colors.primary.main,
    }),
});
