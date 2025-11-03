import { css } from '@emotion/css';
import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom-v5-compat';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Modal, TabsBar, Tab, TabContent, useStyles2, Text } from '@grafana/ui';
import { DashboardInput, DataSourceInput } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { CommunityDashboardMappingForm } from './CommunityDashboardMappingForm';
import { CommunityDashboardSection } from './CommunityDashboardSection';
import { DashboardLibrarySection } from './DashboardLibrarySection';
import { InputMapping } from './utils/autoMapDatasources';

interface DashboardLibraryModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  initialMappingContext?: MappingContext | null;
  defaultTab?: 'datasource' | 'community';
}

type ModalView = 'datasource' | 'community' | 'mapping';

export interface MappingContext {
  dashboardName: string;
  dashboardJson: DashboardJson;
  unmappedInputs: DataSourceInput[];
  constantInputs: DashboardInput[];
  existingMappings: InputMapping[];
  onInterpolateAndNavigate: (mappings: InputMapping[]) => void;
}

export const DashboardLibraryModal = ({
  isOpen,
  onDismiss,
  initialMappingContext,
  defaultTab = 'datasource',
}: DashboardLibraryModalProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const datasourceUid = searchParams.get('dashboardLibraryDatasourceUid');

  const [activeView, setActiveView] = useState<ModalView>(initialMappingContext ? 'mapping' : defaultTab);
  const [mappingContext, setMappingContext] = useState<MappingContext | null>(initialMappingContext || null);
  const styles = useStyles2(getStyles);

  // Get datasource info for modal title and search
  const datasourceInfo = useMemo(() => {
    if (!datasourceUid) {
      return { type: '' };
    }
    const ds = getDataSourceSrv().getInstanceSettings(datasourceUid);
    return {
      type: ds?.type || '',
    };
  }, [datasourceUid]);

  // Update state when initialMappingContext changes or modal opens/closes
  useEffect(() => {
    if (initialMappingContext) {
      setMappingContext(initialMappingContext);
      setActiveView('mapping');
    } else if (isOpen) {
      // When modal opens, set to defaultTab
      setActiveView(defaultTab);
    } else {
      // Reset when modal closes
      setMappingContext(null);
    }
  }, [initialMappingContext, isOpen, defaultTab]);

  const onTabChange = (tab: 'datasource' | 'community') => {
    setActiveView(tab);
    // Update URL to reflect current tab
    setSearchParams((params) => {
      const newParams = new URLSearchParams(params);
      newParams.set('dashboardLibraryTab', tab);
      return newParams;
    });
  };

  const handleShowMapping = (context: MappingContext) => {
    setMappingContext(context);
    setActiveView('mapping');
  };

  const handleBackToDashboards = () => {
    setMappingContext(null);
    setActiveView('community');
  };

  return (
    <Modal
      title={
        activeView === 'mapping' && mappingContext
          ? t('dashboard.library-modal.title-mapping-with-name', 'Configure datasources for {{dashboardName}}', {
              dashboardName: mappingContext.dashboardName,
            })
          : datasourceInfo.type
            ? t(
                'dashboard.library-modal.title-with-datasource',
                'Suggested dashboards for your {{datasourceType}} datasource',
                { datasourceType: datasourceInfo.type }
              )
            : t('dashboard.library-modal.title', 'Suggested dashboards')
      }
      isOpen={isOpen}
      onDismiss={onDismiss}
      closeOnBackdropClick={false}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      {activeView !== 'mapping' && (
        <div className={styles.stickyHeader}>
          <Text element="p">
            <Trans i18nKey="dashboard.library-modal.description">
              Browse and select from data-source provided or community dashboards
            </Trans>
          </Text>

          <TabsBar>
            <Tab
              label={t('dashboard.library-modal.tab-datasource', 'Data-source provided')}
              icon="apps"
              active={activeView === 'datasource'}
              onChangeTab={() => onTabChange('datasource')}
            />
            <Tab
              label={t('dashboard.library-modal.tab-community', 'Community')}
              icon="users-alt"
              active={activeView === 'community'}
              onChangeTab={() => onTabChange('community')}
            />
          </TabsBar>
        </div>
      )}

      <TabContent className={styles.tabContent}>
        {activeView === 'datasource' && <DashboardLibrarySection />}
        {activeView === 'community' && (
          <CommunityDashboardSection onShowMapping={handleShowMapping} datasourceType={datasourceInfo.type} />
        )}
        {activeView === 'mapping' && mappingContext && (
          <CommunityDashboardMappingForm
            dashboardName={mappingContext.dashboardName}
            unmappedInputs={mappingContext.unmappedInputs}
            constantInputs={mappingContext.constantInputs}
            existingMappings={mappingContext.existingMappings}
            onBack={handleBackToDashboards}
            onPreview={(allMappings) => {
              mappingContext.onInterpolateAndNavigate(allMappings);
            }}
          />
        )}
      </TabContent>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '90%',
      maxWidth: '1200px',
      height: '80vh',
      display: 'flex',
      flexDirection: 'column',
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: 0,
      marginBottom: 0,
      height: '100%',
    }),
    stickyHeader: css({
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: theme.colors.background.primary,
      paddingTop: theme.spacing(3),
      paddingLeft: theme.spacing(3),
      paddingRight: theme.spacing(3),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(2),
    }),
    tabContent: css({
      flex: 1,
      overflow: 'auto',
      paddingTop: theme.spacing(3),
      paddingLeft: theme.spacing(3),
      paddingRight: theme.spacing(3),
    }),
  };
}
