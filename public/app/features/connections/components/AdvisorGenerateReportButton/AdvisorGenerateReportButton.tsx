import { t } from '@grafana/i18n';
import { usePluginComponent } from '@grafana/runtime';
import { Tooltip } from '@grafana/ui';

import { useLatestDatasourceCheck } from '../../hooks/useDatasourceAdvisorChecks';

interface GenerateReportButtonProps {
  label?: string;
  loadingLabel?: string;
  autoRegister?: boolean;
  onClick?: () => void;
  icon?: string;
}

const COMPONENT_ID = 'grafana-advisor-app/generate-report-button/v1';

export function AdvisorGenerateReportButton() {
  const { component: GenerateReportButton, isLoading: isButtonLoading } =
    usePluginComponent<GenerateReportButtonProps>(COMPONENT_ID);
  const { check, refetchLatestCheck } = useLatestDatasourceCheck();

  if (isButtonLoading || !GenerateReportButton || (check?.status?.report?.count ?? 0) > 0) {
    return null;
  }

  return (
    <Tooltip
      content={t(
        'connections.advisor-generate-report-button.tooltip',
        'Advisor helps you keep your Grafana instances running smoothly and securely by running checks and suggest actions to fix identified issues'
      )}
    >
      <span>
        <GenerateReportButton
          label={t('connections.advisor-generate-report-button.label', 'Run Advisor checks')}
          loadingLabel={t('connections.advisor-generate-report-button.loading-label', 'Running checks...')}
          autoRegister={true}
          onClick={() => {
            setTimeout(refetchLatestCheck, 1000);
          }}
          icon="cog"
        />
      </span>
    </Tooltip>
  );
}
