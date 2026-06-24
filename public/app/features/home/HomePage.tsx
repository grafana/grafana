import { css } from '@emotion/css';
import { Suspense, useState } from 'react';

import { PageLayoutType, PluginExtensionPoints } from '@grafana/data';
import { GrafanaEdition } from '@grafana/data/internal';
import { t } from '@grafana/i18n';
import { config, renderLimitedComponents, usePluginComponents } from '@grafana/runtime';
import { Button, Stack, useStyles2 } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { SETUPGUIDE_PLUGIN_ID } from 'app/core/constants';
import { isOnPrem } from 'app/core/utils/isOnPrem';

import { canViewFiringAlerts } from './AlertsIncidents/FiringAlertsCard';
import { type HomepageTabExtensionProps } from './DashboardTabs/types';
import { HomePageSkeleton } from './HomePageSkeleton';
import { HomeSection } from './HomeSection';
import useHomeGreeting from './useHomeGreeting';
import { AddWidgetDrawer } from './widgets/AddWidgetDrawer';
import { PersonaPicker } from './widgets/PersonaPicker';
import { WidgetGrid } from './widgets/WidgetGrid';
import { usePanelWidgetEntries } from './widgets/panel/usePanelWidgetEntries';
import { useHomeWidgetCatalog } from './widgets/useHomeWidgetCatalog';
import { useWidgetLayout } from './widgets/useWidgetLayout';

const getEdition = () => {
  if (!isOnPrem()) {
    return t('home.home-page.edition.cloud', 'Grafana Cloud');
  }

  if (config.buildInfo.edition === GrafanaEdition.Enterprise) {
    return t('home.home-page.edition.enterprise', 'Grafana Enterprise');
  }

  return t('home.home-page.edition.open-source', 'Grafana');
};

export default function HomePage() {
  const styles = useStyles2(getStyles);
  const greeting = useHomeGreeting();

  const { isLoading: isLoadingAssistant } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageAssistant,
  });

  const { components: extraComponents, isLoading: isLoadingExtra } = usePluginComponents({
    extensionPointId: PluginExtensionPoints.HomepageExtra,
  });

  const { isLoading: isLoadingTabs } = usePluginComponents<HomepageTabExtensionProps>({
    extensionPointId: PluginExtensionPoints.HomepageTabs,
  });

  const { entries, isLoading: catalogLoading } = useHomeWidgetCatalog();
  const { layout, isLoading: layoutLoading, addWidget, removeWidget, setPositions, applyPreset } = useWidgetLayout();

  const [editing, setEditing] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const items = layout?.items ?? [];
  // Pinned dashboard panels are a dynamic catalog source derived from the layout itself.
  const panelEntries = usePanelWidgetEntries(items);
  const allEntries = [...entries, ...panelEntries];
  const loading = catalogLoading || layoutLoading || isLoadingAssistant || isLoadingExtra || isLoadingTabs;
  // First run (no saved widgets) shows the persona chooser; "Start blank" enters edit mode with an empty grid.
  const showPersona = !loading && items.length === 0 && !editing;

  const extraContent = renderLimitedComponents({
    props: {},
    components: extraComponents,
    pluginId: SETUPGUIDE_PLUGIN_ID,
    wrapper: ({ children }) => (
      <div className={styles.extra}>
        <HomeSection>{children}</HomeSection>
      </div>
    ),
  });
  const skeleton = <HomePageSkeleton showAlertsCard={canViewFiringAlerts()} showExtra={extraContent !== null} />;

  return (
    <Page
      navId="home"
      pageNav={{
        text: greeting,
        subTitle: t('home.home-page.placeholder', 'Welcome to {{edition}}.', { edition: getEdition() }),
        hideFromBreadcrumbs: true,
      }}
      layout={PageLayoutType.Home}
    >
      <Page.Contents>
        {loading ? (
          skeleton
        ) : (
          <Suspense fallback={skeleton}>
            <Stack direction="column" gap={2}>
              {showPersona ? (
                <PersonaPicker
                  onApply={(widgetIds) => applyPreset(widgetIds, entries)}
                  onStartBlank={() => {
                    setEditing(true);
                    setDrawerOpen(true);
                  }}
                />
              ) : (
                <Stack direction="column" gap={2}>
                  <Stack justifyContent="flex-end" gap={1}>
                    {editing ? (
                      <>
                        <Button variant="secondary" icon="plus" onClick={() => setDrawerOpen(true)}>
                          {t('home.widgets.toolbar.add', 'Add widget')}
                        </Button>
                        <Button variant="primary" onClick={() => setEditing(false)}>
                          {t('home.widgets.toolbar.done', 'Done')}
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" icon="pen" onClick={() => setEditing(true)}>
                        {t('home.widgets.toolbar.customize', 'Customize')}
                      </Button>
                    )}
                  </Stack>
                  <WidgetGrid
                    items={items}
                    catalog={allEntries}
                    editing={editing}
                    onChange={setPositions}
                    onRemove={removeWidget}
                  />
                </Stack>
              )}

              {extraContent}
            </Stack>
          </Suspense>
        )}

        {drawerOpen && (
          <AddWidgetDrawer
            catalog={allEntries}
            layoutIds={items.map((item) => item.id)}
            onAdd={addWidget}
            onClose={() => setDrawerOpen(false)}
          />
        )}
      </Page.Contents>
    </Page>
  );
}

const getStyles = () => ({
  extra: css({
    display: 'contents',

    '> div': {
      '&:empty': {
        display: 'none',
      },
    },
  }),
});
