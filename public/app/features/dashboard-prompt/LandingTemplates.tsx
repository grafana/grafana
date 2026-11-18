import { css, cx } from '@emotion/css';
import { useId, useRef, useState } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Grid, Icon, useStyles2 } from '@grafana/ui';
import { getFocusStyles } from '@grafana/ui/internal';
import { GrafanaTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

interface Props {
  testDataSource: DataSourceInstanceListItem | undefined;
  showGrafanaTemplates: boolean;
  showCustomTemplates: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
  className?: string;
}

const noop = () => {};

/**
 * The templates under the new-dashboard prompt: a collapsible panel holding one scrollable grid, the
 * organization's custom templates first, then the Grafana-provisioned ones. Picking a card attaches it to the
 * prompt instead of opening it. As pickers, both lists render bare cards, so they flow into this one grid.
 */
export function LandingTemplates({
  testDataSource,
  showGrafanaTemplates,
  showCustomTemplates,
  onSelectTemplate,
  selectedTemplateId,
  className,
}: Props) {
  const styles = useStyles2(getStyles);
  const titleId = useId();
  const listId = useId();
  const [isOpen, setIsOpen] = useState(true);
  const DashboardTemplatesTab = getDashboardTemplatesTab();
  // Pre-set so the lists' `loaded` events, which report the template modal as their location, stay silent here.
  const customLoadedFiredRef = useRef(true);
  const grafanaLoadedFiredRef = useRef(true);

  // Rendered through a function, as in the template modal: the tab is registered by the enterprise build.
  const renderCustomTemplates = () => {
    if (!DashboardTemplatesTab || !showCustomTemplates) {
      return null;
    }
    return (
      <DashboardTemplatesTab
        isOpen
        onClose={noop}
        loadedFiredRef={customLoadedFiredRef}
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={selectedTemplateId}
      />
    );
  };

  return (
    <section className={cx(styles.panel, className)} aria-labelledby={titleId}>
      <button
        type="button"
        id={titleId}
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
        <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
      </button>
      {isOpen && (
        <div id={listId} className={styles.list}>
          <Grid gap={2} columns={{ xs: 1, sm: 2, lg: 3 }}>
            {renderCustomTemplates()}
            {showGrafanaTemplates && (
              <GrafanaTemplatesTab
                entryPoint=""
                testDataSource={testDataSource}
                onClose={noop}
                loadedFiredRef={grafanaLoadedFiredRef}
                onSelectTemplate={onSelectTemplate}
                selectedTemplateId={selectedTemplateId}
              />
            )}
          </Grid>
        </div>
      )}
    </section>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    // Shrinks with the page and scrolls its grid, so the content below the panel stays in view.
    panel: css({
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      padding: theme.spacing(0, 2, 2),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.lg,
    }),
    toggle: css({
      alignSelf: 'flex-start',
      display: 'inline-flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1, 0),
      background: 'none',
      border: 'none',
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      cursor: 'pointer',
      '&:hover': {
        color: theme.colors.text.primary,
      },
      '&:focus-visible': getFocusStyles(theme),
    }),
    list: css({
      minHeight: 0,
      overflowY: 'auto',
      paddingTop: theme.spacing(0.5),
    }),
  };
}
