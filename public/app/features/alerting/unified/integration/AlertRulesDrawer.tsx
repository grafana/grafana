import { t } from '@grafana/i18n';
import { Drawer, Stack, TextLink } from '@grafana/ui';

import { createRelativeUrl } from '../utils/url';

import AlertRulesDrawerContent from './AlertRulesDrawerContent';

interface Props {
  dashboardUid: string;
  onDismiss: () => void;
}

export function AlertRulesDrawer({ dashboardUid, onDismiss }: Props) {
  return (
    <Drawer
      title={t('alerting.alert-rules-drawer.title-alert-rules', 'Alert rules')}
      subtitle={<DrawerSubtitle dashboardUid={dashboardUid} />}
      onClose={onDismiss}
      size="lg"
    >
      <AlertRulesDrawerContent dashboardUid={dashboardUid} />
    </Drawer>
  );
}

function DrawerSubtitle({ dashboardUid }: { dashboardUid: string }) {
  const searchParams = new URLSearchParams({ search: `dashboard:${dashboardUid}` });

  return (
    <Stack gap={2}>
      <div>{t('dashboard.alert-rules-drawer.subtitle', 'Alert rules related to this dashboard')}</div>
      <TextLink href={createRelativeUrl(`/alerting/list/?${searchParams.toString()}`)}>
        {t('dashboard.alert-rules-drawer.redirect-link', 'List in Grafana Alerting')}
      </TextLink>
    </Stack>
  );
}
