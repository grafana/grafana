import { useState } from 'react';

import { LoadingPlaceholder } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { alertRuleApi } from '../../api/alertRuleApi';

import { FileExportPreview } from './FileExportPreview';
import { GrafanaExportDrawer } from './GrafanaExportDrawer';
import { ExportFormats, allGrafanaExportProviders } from './providers';
interface MuteTimingsExporterPreviewProps {
  exportFormat: ExportFormats;
  onClose: () => void;
}

const GrafanaMuteTimingsExporterPreview = ({ exportFormat, onClose }: MuteTimingsExporterPreviewProps) => {
  const { currentData: muteTimingsDefinition = '', isFetching } = alertRuleApi.useExportMuteTimingsQuery({
    format: exportFormat,
  });
  const downloadFileName = `mute-timings-${new Date().getTime()}`;

  if (isFetching) {
    return (
      <LoadingPlaceholder text={t('alerting.grafana-mute-timings-exporter-preview.text-loading', 'Loading....')} />
    );
  }
  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={muteTimingsDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};

interface GrafanaMuteTimingExporterPreviewProps extends MuteTimingsExporterPreviewProps {
  muteTimingName: string;
}
const GrafanaMuteTimingExporterPreview = ({
  exportFormat,
  onClose,
  muteTimingName,
}: GrafanaMuteTimingExporterPreviewProps) => {
  const { currentData: muteTimingsDefinition = '', isFetching } = alertRuleApi.useExportMuteTimingQuery({
    format: exportFormat,
    muteTiming: muteTimingName,
  });
  const downloadFileName = `mute-timing-${muteTimingName}-${new Date().getTime()}`;

  if (isFetching) {
    return <LoadingPlaceholder text={t('alerting.grafana-mute-timing-exporter-preview.text-loading', 'Loading....')} />;
  }
  return (
    <FileExportPreview
      format={exportFormat}
      textDefinition={muteTimingsDefinition}
      downloadFileName={downloadFileName}
      onClose={onClose}
    />
  );
};
interface GrafanaMuteTimingsExporterProps {
  onClose: () => void;
  muteTimingName?: string;
}

export const GrafanaMuteTimingsExporter = ({ onClose, muteTimingName }: GrafanaMuteTimingsExporterProps) => {
  const [activeTab, setActiveTab] = useState<ExportFormats>('yaml');
  return (
    <GrafanaExportDrawer
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onClose={onClose}
      formatProviders={Object.values(allGrafanaExportProviders)}
    >
      {muteTimingName ? (
        <GrafanaMuteTimingExporterPreview exportFormat={activeTab} onClose={onClose} muteTimingName={muteTimingName} />
      ) : (
        <GrafanaMuteTimingsExporterPreview exportFormat={activeTab} onClose={onClose} />
      )}
    </GrafanaExportDrawer>
  );
};
