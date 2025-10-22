import { css } from '@emotion/css';
import { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
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

export const DashboardLibraryModal = ({ isOpen, onDismiss }: DashboardLibraryModalProps) => {
  const [activeView, setActiveView] = useState<ModalView>('datasource');
  const [mappingContext, setMappingContext] = useState<MappingContext | null>(null);
  const styles = useStyles2(getStyles);

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
        activeView === 'mapping' ? (
          <Trans i18nKey="dashboard.library-modal.title-mapping">Configure datasources</Trans>
        ) : (
          <Trans i18nKey="dashboard.library-modal.title">Suggested dashboards</Trans>
        )
      }
      isOpen={isOpen}
      onDismiss={onDismiss}
      closeOnBackdropClick={false}
      className={styles.modal}
    >
      <div className={styles.content}>
        {activeView !== 'mapping' && (
          <>
            <Text element="p" textAlignment="center">
              <Trans i18nKey="dashboard.library-modal.description">
                Browse and select from data-source provided or community dashboards
              </Trans>
            </Text>

            <TabsBar>
              <Tab
                label={t('dashboard.library-modal.tab-datasource', 'Data-source provided')}
                icon="apps"
                active={activeView === 'datasource'}
                onChangeTab={() => setActiveView('datasource')}
              />
              <Tab
                label={t('dashboard.library-modal.tab-community', 'Community')}
                icon="users-alt"
                active={activeView === 'community'}
                onChangeTab={() => setActiveView('community')}
              />
            </TabsBar>
          </>
        )}

        <TabContent className={styles.tabContent}>
          {activeView === 'datasource' && <DashboardLibrarySection />}
          {activeView === 'community' && <CommunityDashboardSection onShowMapping={handleShowMapping} />}
          {activeView === 'mapping' && mappingContext && (
            <CommunityDashboardMappingForm
              dashboardName={mappingContext.dashboardName}
              unmappedInputs={mappingContext.unmappedInputs}
              constantInputs={mappingContext.constantInputs}
              existingMappings={mappingContext.existingMappings}
              onBack={handleBackToDashboards}
              onPreview={(allMappings) => {
                mappingContext.onInterpolateAndNavigate(allMappings);
                onDismiss();
              }}
            />
          )}
        </TabContent>
      </div>
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '90%',
      maxWidth: '1200px',
    }),
    content: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(3),
    }),
    tabContent: css({
      minHeight: '400px',
    }),
  };
}
