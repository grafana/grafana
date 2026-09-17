import { css } from '@emotion/css';
import { useState, useEffect } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Modal, useStyles2 } from '@grafana/ui';
import { type DashboardInput, type DataSourceInput, type DashboardJson } from 'app/features/manage-dashboards/types';
import { type PluginDashboard } from 'app/types/plugins';

import { CommunityDashboardMappingForm } from './CommunityDashboardMappingForm';
import { SuggestedDashboardsList } from './SuggestedDashboardsList/SuggestedDashboardsList';
import { type ContentKind } from './constants';
import { type GnetDashboard } from './types';
import { type InputMapping } from './utils/autoMapDatasources';

interface SuggestedDashboardsModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  datasourceUid?: string;
  /**
   * Datasource type for the currently scoped datasource (e.g. `prometheus`). Resolved
   * by the parent so the modal and its list child render with a consistent, non-empty
   * value — the list keys analytics on this and only emits its `loaded` event once.
   */
  datasourceType?: string;
  initialMappingContext?: MappingContext | null;
  provisionedDashboards: PluginDashboard[];
  communityDashboards: GnetDashboard[];
  communityTotalPages: number;
  lastPageItemCount?: number;
  onLastPageItemCount?: (count: number) => void;
  isDashboardsLoading: boolean;
}

type ModalView = 'list' | 'mapping';

export interface MappingContext {
  dashboardName: string;
  dashboardJson: DashboardJson;
  unmappedDsInputs: DataSourceInput[];
  constantInputs: DashboardInput[];
  existingMappings: InputMapping[];
  onInterpolateAndNavigate: (mappings: InputMapping[]) => void;
  // Tracking context for analytics
  contentKind: ContentKind;
}

export const SuggestedDashboardsModal = ({
  isOpen,
  onDismiss,
  datasourceUid,
  datasourceType = '',
  initialMappingContext,
  provisionedDashboards,
  communityDashboards,
  communityTotalPages,
  lastPageItemCount,
  onLastPageItemCount,
  isDashboardsLoading,
}: SuggestedDashboardsModalProps) => {
  const [activeView, setActiveView] = useState<ModalView>('list');
  const [mappingContext, setMappingContext] = useState<MappingContext | null>(initialMappingContext || null);
  const styles = useStyles2(getStyles);

  // Update state when initialMappingContext changes or modal opens/closes
  useEffect(() => {
    if (initialMappingContext) {
      setMappingContext(initialMappingContext);
      setActiveView('mapping');
      return;
    }

    if (isOpen) {
      setActiveView('list');
    } else {
      // Reset when modal closes
      setMappingContext(null);
      setActiveView('list');
    }
  }, [initialMappingContext, isOpen]);

  const handleShowMapping = (context: MappingContext) => {
    setMappingContext(context);
    setActiveView('mapping');
  };

  const handleBackToDashboards = () => {
    setMappingContext(null);
    setActiveView('list');
  };

  return (
    <Modal
      title={
        activeView === 'mapping' && mappingContext
          ? t('dashboard-library.modal.title-mapping-with-name', 'Configure datasources for {{dashboardName}}', {
              dashboardName: mappingContext.dashboardName,
            })
          : datasourceType
            ? t(
                'dashboard-library.modal.title-with-datasource',
                'Suggested dashboards for your {{datasourceType}} datasource',
                { datasourceType }
              )
            : t('dashboard-library.modal.title', 'Suggested dashboards')
      }
      isOpen={isOpen}
      onDismiss={onDismiss}
      className={styles.modal}
      contentClassName={styles.modalContent}
    >
      {activeView === 'list' && (
        <div className={styles.listContent}>
          <SuggestedDashboardsList
            provisionedDashboards={provisionedDashboards}
            communityDashboards={communityDashboards}
            communityTotalPages={communityTotalPages}
            lastPageItemCount={lastPageItemCount}
            onLastPageItemCount={onLastPageItemCount}
            datasourceUid={datasourceUid}
            datasourceType={datasourceType}
            isDashboardsLoading={isDashboardsLoading}
            onShowMapping={handleShowMapping}
            onDismiss={onDismiss}
          />
        </div>
      )}
      {activeView === 'mapping' && mappingContext && (
        <div className={styles.listContent}>
          <CommunityDashboardMappingForm
            unmappedDsInputs={mappingContext.unmappedDsInputs}
            constantInputs={mappingContext.constantInputs}
            existingMappings={mappingContext.existingMappings}
            onBack={handleBackToDashboards}
            onPreview={(allMappings) => {
              mappingContext.onInterpolateAndNavigate(allMappings);
            }}
            dashboardName={mappingContext.dashboardName}
            libraryItemId={String(mappingContext.dashboardJson.gnetId || '')}
            contentKind={mappingContext.contentKind}
            datasourceTypes={[datasourceType]}
          />
        </div>
      )}
    </Modal>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    modal: css({
      width: '90%',
      maxWidth: '1200px',
      maxHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
    }),
    modalContent: css({
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      padding: theme.spacing(2),
      marginBottom: 0,
      height: '100%',
    }),
    listContent: css({
      flex: 1,
      overflow: 'auto',
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    }),
  };
}
