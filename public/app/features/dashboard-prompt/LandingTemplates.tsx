import { css } from '@emotion/css';
import { useId, useRef } from 'react';

import { type DataSourceInstanceListItem, type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Grid, useStyles2 } from '@grafana/ui';
import { GrafanaTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/GrafanaTemplatesTab';
import { getDashboardTemplatesTab } from 'app/features/dashboard/dashgrid/DashboardLibrary/enterprise-components/DashboardTemplatesTabExtension';
import { type TemplateSelection } from 'app/features/dashboard/dashgrid/DashboardLibrary/types';

interface Props {
  testDataSource: DataSourceInstanceListItem | undefined;
  showGrafanaTemplates: boolean;
  showCustomTemplates: boolean;
  onSelectTemplate: (selection: TemplateSelection) => void;
  selectedTemplateId?: string;
}

const noop = () => {};

/**
 * The templates under the new-dashboard prompt, as one grid: the organization's custom templates first, then
 * the Grafana-provisioned ones. Picking a card attaches it to the prompt instead of opening it. As pickers,
 * both lists render bare cards, so they flow into this one grid.
 */
export function LandingTemplates({
  testDataSource,
  showGrafanaTemplates,
  showCustomTemplates,
  onSelectTemplate,
  selectedTemplateId,
}: Props) {
  const styles = useStyles2(getStyles);
  const titleId = useId();
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
    <section className={styles.root} aria-labelledby={titleId}>
      <h3 id={titleId} className={styles.title}>
        <Trans i18nKey="dashboard.empty.templates-title">Start from a template</Trans>
      </h3>
      <Grid gap={4} columns={{ xs: 1, sm: 2, lg: 3 }}>
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
    </section>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    title: css({
      margin: 0,
      fontSize: theme.typography.h5.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
    }),
  };
}
