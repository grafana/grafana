import { css } from '@emotion/css';
import { useState, type KeyboardEvent } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { locationService, reportInteraction } from '@grafana/runtime';
import { Badge, Icon, IconButton, LinkButton, Stack, TextArea, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

const TEMPLATE_MODAL_HREF = '/dashboards?templateDashboards=true&source=createNewButton';
const BLANK_DASHBOARD_HREF = '/dashboard/new';
const IMPORT_DASHBOARD_HREF = '/dashboard/import';
const WORKSPACE_PATH = '/a/grafana-assistant-app/workspace';

// Grafana brand orange used for the Assistant accent (spotlight, sparkle glow, focus ring).
const BRAND_ORANGE = '#FF8833';

type TemplateCategory = {
  id: 'infrastructure' | 'application' | 'database' | 'cloud';
  label: string;
  hint: string;
  icon: 'cube' | 'globe' | 'database' | 'cloud';
};

export default function DashboardCreatorPage() {
  const styles = useStyles2(getStyles);
  const { isAvailable } = useAssistant();
  const [prompt, setPrompt] = useState('');

  const trimmed = prompt.trim();
  const canSubmit = isAvailable && trimmed.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    reportInteraction('grafana_dashboard_creator_prompt_submit', { length: trimmed.length });
    const params = new URLSearchParams({
      prompt: trimmed,
      mode: 'dashboarding',
      autoSend: 'true',
    });
    locationService.push(`${WORKSPACE_PATH}?${params.toString()}`);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleTemplateClick = (category: TemplateCategory['id']) => {
    reportInteraction('grafana_dashboard_creator_template_click', { category });
  };

  const handleBlankClick = () => {
    reportInteraction('grafana_dashboard_creator_blank_click');
  };

  const handleImportClick = () => {
    reportInteraction('grafana_dashboard_creator_import_click');
  };

  const templates: TemplateCategory[] = [
    {
      id: 'infrastructure',
      label: t('dashboard-creator.template.infrastructure.label', 'Infrastructure'),
      hint: t('dashboard-creator.template.infrastructure.hint', 'Kubernetes cluster'),
      icon: 'cube',
    },
    {
      id: 'application',
      label: t('dashboard-creator.template.application.label', 'Application'),
      hint: t('dashboard-creator.template.application.hint', 'Web application'),
      icon: 'globe',
    },
    {
      id: 'database',
      label: t('dashboard-creator.template.database.label', 'Database'),
      hint: t('dashboard-creator.template.database.hint', 'PostgreSQL'),
      icon: 'database',
    },
    {
      id: 'cloud',
      label: t('dashboard-creator.template.cloud.label', 'Cloud'),
      hint: t('dashboard-creator.template.cloud.hint', 'AWS EC2 fleet'),
      icon: 'cloud',
    },
  ];

  return (
    <Page
      navId="dashboards/browse"
      pageNav={{
        text: t('dashboard-creator.page-nav.text', 'Dashboard Creator'),
      }}
    >
      <Page.Contents>
        <div className={styles.canvas}>
          <div className={styles.shell}>
            <header className={styles.header}>
              <div className={styles.sparkle}>
                <Icon name="ai-sparkle" size="xxxl" />
              </div>
              <div className={styles.greeting}>
                <Trans i18nKey="dashboard-creator.header.greeting">Hi, I&apos;m</Trans>
              </div>
              <h1 className={styles.title}>
                <Trans i18nKey="dashboard-creator.header.title">Dashboard Creator</Trans>
              </h1>
              <Stack direction="row" alignItems="center" gap={1} justifyContent="center">
                <Badge text={t('dashboard-creator.header.badge.beta', 'BETA')} color="orange" />
                {/* eslint-disable-next-line @grafana/i18n/no-untranslated-strings */}
                <span className={styles.version}>v0.1</span>
              </Stack>
              <p className={styles.description}>
                <Trans i18nKey="dashboard-creator.header.description">
                  A purpose-built assistant for Grafana that helps you draft new dashboards — panels, queries, and
                  layout — from a plain English description.
                </Trans>
              </p>
            </header>

            <section className={styles.promptCard} aria-label={t('dashboard-creator.prompt.label', 'Dashboard prompt')}>
              <TextArea
                className={styles.promptInput}
                value={prompt}
                onChange={(e) => setPrompt(e.currentTarget.value)}
                onKeyDown={handleKeyDown}
                rows={4}
                placeholder={t('dashboard-creator.prompt.placeholder', 'Describe the dashboard you want to create…')}
                disabled={!isAvailable}
              />
              <div className={styles.promptFooter}>
                <div className={styles.modeChip}>
                  <Icon name="ai-sparkle" size="sm" />
                  <span>
                    <Trans i18nKey="dashboard-creator.prompt.mode-chip">Assistant</Trans>
                  </span>
                </div>
                <IconButton
                  name="enter"
                  size="lg"
                  aria-label={t('dashboard-creator.prompt.submit-aria', 'Send to Assistant')}
                  disabled={!canSubmit}
                  onClick={handleSubmit}
                />
              </div>
              {!isAvailable && (
                <p className={styles.unavailable}>
                  <Trans i18nKey="dashboard-creator.prompt.unavailable">
                    The Grafana Assistant isn&apos;t available in this environment. You can still start from a template,
                    a blank dashboard, or by importing JSON below.
                  </Trans>
                </p>
              )}
            </section>

            <section
              className={styles.templateSection}
              aria-label={t('dashboard-creator.templates.label', 'Templates')}
            >
              <h2 className={styles.sectionHeading}>
                <span className={styles.sectionRule} aria-hidden />
                <span>
                  <Trans i18nKey="dashboard-creator.templates.heading">Or start from a template</Trans>
                </span>
                <span className={styles.sectionRule} aria-hidden />
              </h2>
              <div className={styles.templateGrid}>
                {templates.map((template) => (
                  <a
                    key={template.id}
                    href={TEMPLATE_MODAL_HREF}
                    onClick={() => handleTemplateClick(template.id)}
                    className={styles.templateCard}
                    data-template-id={template.id}
                  >
                    <div className={styles.templateIcon}>
                      <Icon name={template.icon} size="lg" />
                    </div>
                    <div>
                      <div className={styles.templateLabel}>{template.label}</div>
                      <div className={styles.templateHint}>{template.hint}</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            <footer className={styles.footerLinks}>
              <LinkButton
                variant="primary"
                fill="text"
                icon="plus"
                href={BLANK_DASHBOARD_HREF}
                onClick={handleBlankClick}
              >
                <Trans i18nKey="dashboard-creator.footer.start-blank">Start with a blank dashboard</Trans>
              </LinkButton>
              <span className={styles.footerSeparator} aria-hidden>
                ·
              </span>
              <LinkButton
                variant="primary"
                fill="text"
                icon="import"
                href={IMPORT_DASHBOARD_HREF}
                onClick={handleImportClick}
              >
                <Trans i18nKey="dashboard-creator.footer.import-json">Import from JSON</Trans>
              </LinkButton>
            </footer>
          </div>
        </div>
      </Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  canvas: css({
    position: 'relative',
    flex: 1,
    minHeight: '100%',
    overflowX: 'hidden',
    backgroundImage: [
      // Soft orange spotlight halo at top-center
      `radial-gradient(ellipse 900px 460px at 50% 0%, rgba(255, 136, 51, 0.08), transparent 70%)`,
      // 22px dot grid
      `radial-gradient(circle at 1px 1px, ${theme.colors.border.weak} 1px, transparent 0)`,
    ].join(', '),
    backgroundSize: '100% 100%, 22px 22px',
    backgroundRepeat: 'no-repeat, repeat',
  }),
  shell: css({
    position: 'relative',
    zIndex: 1,
    margin: '0 auto',
    maxWidth: 720,
    padding: theme.spacing(4, 2, 8),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(4),
  }),
  header: css({
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  sparkle: css({
    color: BRAND_ORANGE,
    marginBottom: theme.spacing(1),
    filter: 'drop-shadow(0 0 18px rgba(255, 136, 51, 0.45)) drop-shadow(0 0 4px rgba(255, 136, 51, 0.55))',
  }),
  greeting: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
  }),
  title: css({
    fontSize: theme.typography.h1.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    margin: 0,
  }),
  version: css({
    color: theme.colors.text.secondary,
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  description: css({
    color: theme.colors.text.secondary,
    margin: theme.spacing(2, 0, 0),
    maxWidth: 520,
  }),
  promptCard: css({
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.primary,
    padding: theme.spacing(2),
    boxShadow: theme.shadows.z2,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['border-color', 'box-shadow']),
    },
    '&:focus-within': {
      borderColor: 'rgba(255, 136, 51, 0.55)',
      boxShadow: '0 0 0 3px rgba(255, 136, 51, 0.18), 0 6px 24px rgba(0, 0, 0, 0.32)',
    },
  }),
  promptInput: css({
    border: 'none',
    background: 'transparent',
    resize: 'vertical',
    minHeight: 96,
    '&:focus, &:hover': {
      border: 'none',
      outline: 'none',
      boxShadow: 'none',
    },
  }),
  promptFooter: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }),
  modeChip: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    '& svg': {
      color: BRAND_ORANGE,
    },
  }),
  unavailable: css({
    margin: 0,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  templateSection: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  sectionHeading: css({
    margin: 0,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.body.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  }),
  sectionRule: css({
    flex: 1,
    height: 1,
    background: theme.colors.border.weak,
  }),
  templateGrid: css({
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing(2),
    [theme.breakpoints.down('sm')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  templateCard: css({
    display: 'flex',
    gap: theme.spacing(2),
    alignItems: 'center',
    padding: theme.spacing(2),
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    textDecoration: 'none',
    border: `1px solid ${theme.colors.border.weak}`,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background', 'border-color']),
    },
    '&:hover': {
      background: theme.colors.action.hover,
      borderColor: theme.colors.border.medium,
      textDecoration: 'none',
    },
  }),
  templateIcon: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    background: theme.colors.background.canvas,
    color: theme.colors.text.secondary,
    flexShrink: 0,
  }),
  templateLabel: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  templateHint: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  footerLinks: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
  }),
  footerSeparator: css({
    color: theme.colors.text.secondary,
  }),
});
