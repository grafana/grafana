import { useState } from 'react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';
import { appEvents } from 'app/core/app_events';

import { exportUsers, type UserExportOptions } from './exportUsers';

interface Props extends UserExportOptions {
  className?: string;
}

export function ExportUsersButton({ className, ...options }: Props) {
  const [isExporting, setIsExporting] = useState(false);
  const downloadLabel = t('admin.users-export.download', 'Download table as CSV');

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
      className={className}
      variant="secondary"
      icon={isExporting ? 'spinner' : 'download-alt'}
      tooltip={downloadLabel}
      aria-label={isExporting ? t('admin.users-export.exporting', 'Exporting…') : downloadLabel}
      disabled={isExporting}
      onClick={onExport}
    />
  );
}
