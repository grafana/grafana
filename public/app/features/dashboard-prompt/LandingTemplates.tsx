import { css, cx } from '@emotion/css';
import { useCallback, useId, useRef, useState } from 'react';

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
  // Undefined until each list reports how many templates it shows.
  const [counts, setCounts] = useState<{ custom?: number; grafana?: number }>({});
  // A person's own toggle wins over the default.
  const [openedByUser, setOpenedByUser] = useState<boolean>();
  const onCustomTemplatesLoad = useCallback((custom: number) => setCounts((current) => ({ ...current, custom })), []);
  const onGrafanaTemplatesLoad = useCallback(
    (grafana: number) => setCounts((current) => ({ ...current, grafana })),
    []
  );
  const DashboardTemplatesTab = getDashboardTemplatesTab();
  const hasCustomTemplates = Boolean(DashboardTemplatesTab) && showCustomTemplates;
  const loaded =
    (!hasCustomTemplates || counts.custom !== undefined) && (!showGrafanaTemplates || counts.grafana !== undefined);
  const isEmpty = loaded && (counts.custom ?? 0) + (counts.grafana ?? 0) === 0;
  // Open while the lists load and when they show templates; closed when there are none to show.
  const isOpen = openedByUser ?? !isEmpty;
  // Pre-set so the lists' `loaded` events, which report the template modal as their location, stay silent here.
  const customLoadedFiredRef = useRef(true);
  const grafanaLoadedFiredRef = useRef(true);

  // Rendered through a function, as in the template modal: the tab is registered by the enterprise build.
  const renderCustomTemplates = () => {
    if (!DashboardTemplatesTab || !hasCustomTemplates) {
      return null;
    }
    return (
      <DashboardTemplatesTab
        isOpen
        onClose={noop}
        loadedFiredRef={customLoadedFiredRef}
        onSelectTemplate={onSelectTemplate}
        selectedTemplateId={selectedTemplateId}
        onTemplatesLoad={onCustomTemplatesLoad}
      />
    );
  };

  return (
    <section className={cx(styles.panel, !isOpen && styles.panelClosed, className)} aria-labelledby={titleId}>
      <button
        type="button"
        id={titleId}
        className={styles.toggle}
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setOpenedByUser(!isOpen)}
      >
        <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
        <Icon name={isOpen ? 'angle-up' : 'angle-down'} />
      </button>
      {/* Hidden, not unmounted: reopening keeps the loaded templates instead of refetching them. */}
      <div id={listId} className={styles.list} hidden={!isOpen}>
        {isEmpty && (
          <p className={styles.empty}>
            <Trans i18nKey="dashboard.empty.templates-empty">No templates available</Trans>
          </p>
        )}
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
              onTemplatesLoad={onGrafanaTemplatesLoad}
            />
          )}
        </Grid>
      </div>
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
    // Closed, the header sits as far from the panel's bottom edge as from the prompt above it: the same inset
    // the page leaves past the prompt's edge, since the header's own padding already applies on both sides.
    panelClosed: css({
      paddingBottom: theme.spacing(0.5),
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
      '&[hidden]': {
        display: 'none',
      },
    }),
    empty: css({
      margin: 0,
      color: theme.colors.text.secondary,
      fontSize: theme.typography.bodySmall.fontSize,
    }),
  };
}
