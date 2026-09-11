import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2 } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Box, Modal, Tab, TabsBar, Text, useStyles2 } from '@grafana/ui';

import { GrafanaTemplatesTab } from './GrafanaTemplatesTab';
import { getDashboardTemplatesTab } from './enterprise-components/DashboardTemplatesTabExtension';
import { useTemplateDashboardsAvailability } from './hooks/useTemplateDashboardsAvailability';

type TemplateTab = 'grafana' | 'custom';

export const TemplateDashboardModal = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const isOpen = searchParams.get('templateDashboards') === 'true';
  const entryPoint = searchParams.get('source') || '';
  const DashboardTemplatesTab = getDashboardTemplatesTab();
  const { testDataSource, showGrafanaTemplates, showCustomTemplates } = useTemplateDashboardsAvailability();
  const [activeTab, setActiveTab] = useState<TemplateTab>(showCustomTemplates ? 'custom' : 'grafana');

  // Guard the per-tab `loaded` events to fire once per open. Owned here (not in the tab
  // components) so they survive a tab unmounting/remounting when the user toggles tabs.
  const grafanaLoadedFiredRef = useRef(false);
  const customLoadedFiredRef = useRef(false);

  const styles = useStyles2(getStyles);

  const onClose = () => {
    searchParams.delete('templateDashboards');
    setSearchParams(searchParams);
  };

  // Reset the once-per-open guards whenever the modal closes, so the `loaded` events can
  // fire again the next time the modal is opened.
  useEffect(() => {
    if (!isOpen) {
      grafanaLoadedFiredRef.current = false;
      customLoadedFiredRef.current = false;
      setActiveTab(showCustomTemplates ? 'custom' : 'grafana');
    }
  }, [isOpen, showCustomTemplates]);

  if (!showGrafanaTemplates && !showCustomTemplates) {
    return null;
  }

  const renderGrafanaTemplates = () => {
    if (!showGrafanaTemplates) {
      return null;
    }
    return (
      <GrafanaTemplatesTab
        entryPoint={entryPoint}
        testDataSource={testDataSource}
        onClose={onClose}
        loadedFiredRef={grafanaLoadedFiredRef}
      />
    );
  };

  const renderDashboardTemplates = () => {
    if (!DashboardTemplatesTab || !showCustomTemplates) {
      return null;
    }
    return <DashboardTemplatesTab isOpen={isOpen} onClose={onClose} loadedFiredRef={customLoadedFiredRef} />;
  };

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={onClose}
      className={styles.modal}
      title={t('dashboard-library.template-dashboard-modal.title', 'Start a dashboard from a template')}
      contentClassName={styles.modalContent}
    >
      <div className={styles.stickyHeader}>
        <Text element="p">
          {activeTab === 'custom' ? (
            <Trans i18nKey="dashboard-library.template-dashboard-modal.description-custom">
              Get started with templates. Connect your data to power them with real metrics.
            </Trans>
          ) : (
            <Trans i18nKey="dashboard-library.template-dashboard-modal.description">
              Get started with Grafana templates. Connect your data to power them with real metrics.
            </Trans>
          )}
        </Text>
        {showCustomTemplates && showGrafanaTemplates && (
          <Box marginTop={2}>
            <TabsBar>
              <Tab
                label={t('dashboard-library.template-dashboard-modal.tab-custom', 'Custom templates')}
                active={activeTab === 'custom'}
                onChangeTab={() => setActiveTab('custom')}
              />
              <Tab
                label={t('dashboard-library.template-dashboard-modal.tab-grafana', 'Grafana-provisioned')}
                active={activeTab === 'grafana'}
                onChangeTab={() => setActiveTab('grafana')}
              />
            </TabsBar>
          </Box>
        )}
      </div>
      <Box direction="column" gap={4} display="flex">
        {showCustomTemplates && activeTab === 'custom' ? renderDashboardTemplates() : renderGrafanaTemplates()}
      </Box>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '1200px',
    }),
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(2),
    }),
    modalContent: css({
      paddingTop: 0,
      height: '100%',
    }),
  };
}
