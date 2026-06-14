import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Badge, Box, Icon, Stack, Text, TextLink, useStyles2 } from '@grafana/ui';

/** Static informational sections shown below the setup steps on the onboarding overview. */
export function ContentSections() {
  return (
    <>
      <IncludedFreePanel />
      <DataAccessSection />
      <CapabilitiesSection />
      <RequirementsSection />
    </>
  );
}

function IncludedFreePanel() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.included-free.heading">
          Included free, no credit card required
        </Trans>
      </Text>
      <Box backgroundColor="secondary" borderColor="weak" borderStyle="solid" padding={3}>
        <Stack direction="column" gap={2}>
          <div>
            <Badge
              text={t('plugins.assistant-get-started.included-free.badge', 'Included free')}
              color="green"
              icon="ai-sparkle"
            />
          </div>
          <Text color="secondary">
            <Trans i18nKey="plugins.assistant-get-started.included-free.description">
              Grafana Assistant is included in the Grafana Cloud forever free plan with generous limits so you can get
              started right away.
            </Trans>
          </Text>
          <Stack direction="column" gap={1}>
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-team',
                'Free access for your team on Grafana Cloud'
              )}
            />
            <FeatureItem
              text={t('plugins.assistant-get-started.included-free.item-usage', 'Generous usage for getting started')}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-nl',
                'Natural language to PromQL, LogQL, TraceQL, and SQL'
              )}
            />
            <FeatureItem
              text={t('plugins.assistant-get-started.included-free.item-dashboards', 'Dashboard creation and editing')}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-alerts',
                'Alert investigation and troubleshooting'
              )}
            />
            <FeatureItem
              text={t(
                'plugins.assistant-get-started.included-free.item-navigation',
                'Navigation and discovery assistance'
              )}
            />
          </Stack>
          <Text color="secondary" variant="bodySmall">
            <Trans i18nKey="plugins.assistant-get-started.included-free.pricing">
              Need more capacity or advanced plan features?{' '}
              <TextLink href="https://grafana.com/pricing/" external>
                View pricing plans →
              </TextLink>
            </Trans>
          </Text>
        </Stack>
      </Box>
    </Stack>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <Stack direction="row" gap={1} alignItems="center">
      <Icon name="check" size="sm" />
      <Text color="secondary">{text}</Text>
    </Stack>
  );
}

function DataAccessSection() {
  const styles = useStyles2(getStyles);

  const faqs = [
    {
      question: t('plugins.assistant-get-started.data-access.faq-third-parties-q', 'Is my data sent to third parties?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-third-parties-a',
        'No. Queries are processed by Grafana Labs infrastructure. All communication is encrypted in transit.'
      ),
    },
    {
      question: t('plugins.assistant-get-started.data-access.faq-rbac-q', 'Does this work with RBAC?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-rbac-a',
        'Yes. The Assistant respects your existing role-based access control. Users only see resources they have access to.'
      ),
    },
    {
      question: t('plugins.assistant-get-started.data-access.faq-non-admin-q', 'Can non-admin users use it?'),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-non-admin-a',
        'Yes, once an admin has installed the plugin and connected to Cloud, any user in the org can use the Assistant based on their existing permissions.'
      ),
    },
    {
      question: t(
        'plugins.assistant-get-started.data-access.faq-self-managed-q',
        'Is this available for self-managed Grafana?'
      ),
      answer: t(
        'plugins.assistant-get-started.data-access.faq-self-managed-a',
        "Yes — that's exactly what this setup flow is for."
      ),
    },
  ];

  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.data-access.heading">What data does the Assistant access?</Trans>
      </Text>
      <Text color="secondary">
        <Trans i18nKey="plugins.assistant-get-started.data-access.intro">
          The Assistant reads <strong>metadata and schema only</strong> — dashboard names, panel titles, data source
          types, and metric/label names. It never reads your actual metric data or query results.
        </Trans>
      </Text>
      <table className={styles.faqTable}>
        <thead>
          <tr className={styles.faqHeader}>
            <th>
              <Text weight="medium">
                <Trans i18nKey="plugins.assistant-get-started.data-access.col-question">Question</Trans>
              </Text>
            </th>
            <th>
              <Text weight="medium">
                <Trans i18nKey="plugins.assistant-get-started.data-access.col-answer">Answer</Trans>
              </Text>
            </th>
          </tr>
        </thead>
        <tbody>
          {faqs.map((faq) => (
            <tr key={faq.question} className={styles.faqRow}>
              <td>
                <Text>{faq.question}</Text>
              </td>
              <td>
                <Text color="secondary">{faq.answer}</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Stack>
  );
}

function CapabilitiesSection() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.capabilities.heading">What Grafana Assistant can do</Trans>
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-analysis',
            'Data analysis and querying: Ask about performance, launch investigations, correlate metrics, logs, traces, profiles, and SQL data.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-dashboards',
            'Dashboard management: Create dashboards or refine existing panels, layouts, and variables.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-queries',
            'Query assistance: Build and refine PromQL, LogQL, TraceQL, SQL, and k6 queries with validation.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-navigation',
            'Navigation and discovery: Find dashboards, data sources, and tools without leaving the conversation.'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.capabilities.item-knowledge',
            'Knowledge and best practices: Get Grafana guidance and observability strategies in context.'
          )}
        />
      </Stack>
    </Stack>
  );
}

function RequirementsSection() {
  return (
    <Stack direction="column" gap={2}>
      <Text element="h2" variant="h4" weight="medium">
        <Trans i18nKey="plugins.assistant-get-started.requirements.heading">Requirements</Trans>
      </Text>
      <Stack direction="column" gap={1}>
        <FeatureItem text={t('plugins.assistant-get-started.requirements.item-version', 'Grafana 13.0.0 or later')} />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.requirements.item-admin',
            'Organization administrator access (for installation and Cloud connection)'
          )}
        />
        <FeatureItem
          text={t(
            'plugins.assistant-get-started.requirements.item-cloud',
            'A Grafana Cloud account (free tier available)'
          )}
        />
      </Stack>
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  faqTable: css({
    width: '100%',
    borderCollapse: 'collapse',
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
  }),
  faqHeader: css({
    '& > th': {
      padding: theme.spacing(1.5, 2),
      backgroundColor: theme.colors.background.secondary,
      borderBottom: `2px solid ${theme.colors.border.medium}`,
      textAlign: 'left',
    },
  }),
  faqRow: css({
    '& > td': {
      padding: theme.spacing(1.5, 2),
      borderBottom: `1px solid ${theme.colors.border.weak}`,
      verticalAlign: 'top',
    },
    '&:last-child > td': {
      borderBottom: 'none',
    },
  }),
});
