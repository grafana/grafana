import React, { useEffect } from 'react';
import { useToggle } from 'react-use';

import { Drawer, Stack, TextLink, ToolbarButton } from '@grafana/ui';
import { useDispatch } from 'app/types';

import { t } from '../../../../core/internationalization';
import { RulesTable } from '../../../alerting/unified/components/rules/RulesTable';
import { useCombinedRuleNamespaces } from '../../../alerting/unified/hooks/useCombinedRuleNamespaces';
import { fetchPromAndRulerRulesAction } from '../../../alerting/unified/state/actions';
import { Annotation } from '../../../alerting/unified/utils/constants';
import { GRAFANA_RULES_SOURCE_NAME } from '../../../alerting/unified/utils/datasource';
import { createUrl } from '../../../alerting/unified/utils/url';

interface Props {
  dashboardUid: string;
  onClose: () => void;
}

export function AlertRulesDrawer({ dashboardUid, onClose }: Props) {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchPromAndRulerRulesAction({ rulesSourceName: GRAFANA_RULES_SOURCE_NAME }));
  }, [dispatch]);

  const grafanaNamespaces = useCombinedRuleNamespaces(GRAFANA_RULES_SOURCE_NAME);
  const rules = grafanaNamespaces
    .flatMap((ns) => ns.groups)
    .flatMap((g) => g.rules)
    .filter((rule) => rule.annotations[Annotation.dashboardUID] === dashboardUid);

  return (
    <Drawer title="Alert rules" subtitle={<DrawerSubtitle dashboardUid={dashboardUid} />} onClose={onClose} size="lg">
      <RulesTable rules={rules} showNextEvaluationColumn={false} showGroupColumn={false} />
    </Drawer>
  );
}

function DrawerSubtitle({ dashboardUid }: { dashboardUid: string }) {
  const searchParams = new URLSearchParams({ search: `dashboard:${dashboardUid}` });

  return (
    <Stack gap={2}>
      <div>{t('dashboard.toolbar.alert-rules.subtitle', 'Alert rules related to this dashboard')}</div>
      <TextLink href={createUrl(`/alerting/list/?${searchParams.toString()}`)}>
        {t('dashboard.toolbar.alert-rules.redirect-link', 'View in Alerting')}
      </TextLink>
    </Stack>
  );
}
interface AlertRulesToolbarButtonProps {
  dashboardUid: string;
}

export function AlertRulesToolbarButton({ dashboardUid }: AlertRulesToolbarButtonProps) {
  const [showDrawer, toggleShowDrawer] = useToggle(false);

  return (
    <>
      <ToolbarButton
        tooltip={t('dashboard.toolbar.alert-rules', 'Alert rules')}
        icon="bell"
        onClick={toggleShowDrawer}
        key="button-alerting"
      />
      {showDrawer && <AlertRulesDrawer dashboardUid={dashboardUid} onClose={toggleShowDrawer} />}
    </>
  );
}
