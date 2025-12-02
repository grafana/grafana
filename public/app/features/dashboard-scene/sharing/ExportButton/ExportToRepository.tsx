import { SceneComponentProps } from '@grafana/scenes';
import { t } from '@grafana/i18n';
import { BulkExportProvisionedResource } from 'app/features/provisioning/components/BulkActions/BulkExportProvisionedResource';
import { DashboardScene } from '../../scene/DashboardScene';
import { ShareExportTab } from '../ShareExportTab';

export class ExportToRepository extends ShareExportTab {
  static Component = ExportToRepositoryRenderer;

  public getTabLabel(): string {
    return t('share-modal.export.export-to-repository-title', 'Export Dashboard to Repository');
  }
}

function ExportToRepositoryRenderer({ model }: SceneComponentProps<ExportToRepository>) {
  const dashboard = model.getRoot();
  if (!(dashboard instanceof DashboardScene)) {
    return <></>;
  }

  return (
    <BulkExportProvisionedResource
      folderUid={dashboard.state.meta.folderUid || ''}
      selectedItems={{
        dashboard: dashboard.state.uid ? { [dashboard.state.uid]: true } : {},
        folder: {},
      }}
      onDismiss={model.useState().onDismiss}
    />
  );
}
