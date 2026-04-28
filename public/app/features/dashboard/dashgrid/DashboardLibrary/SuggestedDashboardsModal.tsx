import { css } from '@emotion/css';
import { useState, useEffect, useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { Modal } from '@grafana/ui';
import { useStyles2 } from '@grafana/ui/themes';
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

  // Get datasource info for modal title
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
          : datasourceInfo.type
            ? t(
                'dashboard-library.modal.title-with-datasource',
                'Suggested dashboards for your {{datasourceType}} datasource',
                { datasourceType: datasourceInfo.type }
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
            datasourceType={datasourceInfo.type}
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
            datasourceTypes={[datasourceInfo.type]}
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
