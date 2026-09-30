import { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { exportUsers, type UserExportOptions } from './exportUsers';

export function ExportUsersButton(options: UserExportOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const onExport = async () => {
    setIsExporting(true);
    try {
      await exportUsers(options);
    } catch {
      appEvents.emit(AppEvents.alertError, [
        t('admin.users-export.error', 'Failed to export users. Please try again.'),
      ]);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="secondary"
      icon={isExporting ? 'spinner' : 'download-alt'}
      disabled={isExporting}
      onClick={onExport}
    >
      {isExporting ? t('admin.users-export.exporting', 'Exporting…') : t('admin.users-export.download', 'Download CSV')}
    </Button>
  );
}
