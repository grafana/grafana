import { locationService } from '@grafana/runtime';
import { Tooltip, useTheme2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface Props {
  uid?: string;
}

export const ManageScheduleButton = ({ uid }: Props) => {
  const theme = useTheme2();

  return (
    <Tooltip content={t('bmc.dashboard.toolbar.manage-reports', 'Manage scheduled reports')}>
      <div
        onClick={() => {
          sessionStorage.removeItem('reportFilter');
          locationService.push({
            search: locationService.getSearch().toString(),
            pathname: `/a/reports/f/${uid}`,
          });
        }}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px' }}
      >
        <img
          alt="Manage Reports"
          style={{
            width: '22px',
            filter: theme.isDark ? 'brightness(1.2)' : 'brightness(0.5)',
          }}
          src="public/img/icon_scheduler.svg"
        />
      </div>
    </Tooltip>
  );
};
