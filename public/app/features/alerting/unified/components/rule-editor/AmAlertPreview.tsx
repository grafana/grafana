import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useAsync } from 'react-use';

import { LoadingPlaceholder, Stack, TagList } from '@grafana/ui';
import { Matcher } from 'app/plugins/datasource/alertmanager/types';

import { Labels } from '../../../../../types/unified-alerting-dto';
import { useAlertManagersByPermission } from '../../hooks/useAlertManagerSources';
import { useUnifiedAlertingSelector } from '../../hooks/useUnifiedAlertingSelector';
import { fetchAlertManagerConfigAction } from '../../state/actions';
import { labelsMatchMatchers, matcherFieldToMatcher, matcherToMatcherField } from '../../utils/alertmanager';
import { AlertManagerPicker } from '../AlertManagerPicker';

interface AmAlertPreviewProps {
  alertLabels: Labels;
}

export function AmAlertPreview({ alertLabels }: AmAlertPreviewProps) {
  const dispatch = useDispatch();

  const alertmanagers = useAlertManagersByPermission('notification');
  const [alertmanagerName, setAlertmanagerName] = useState<string | undefined>(alertmanagers[0]?.name);

  const amConfigs = useUnifiedAlertingSelector((ua) => ua.amConfigs);
  const amConfig = alertmanagerName ? amConfigs[alertmanagerName]?.result : undefined;

  const amRoutes =
    amConfig?.alertmanager_config.route?.routes?.map((route) => ({
      matchers:
        route.object_matchers?.map<Matcher>((match) =>
          matcherFieldToMatcher({
            name: match[0],
            operator: match[1],
            value: match[2],
          })
        ) ?? [],
    })) ?? [];

  const amConfigState = useAsync(async () => {
    if (alertmanagerName) {
      await dispatch(fetchAlertManagerConfigAction(alertmanagerName));
    }
  }, [alertmanagerName]);

  return (
    <div>
      <AlertManagerPicker onChange={setAlertmanagerName} current={alertmanagerName} dataSources={alertmanagers} />
      {amConfigState.loading && <LoadingPlaceholder text="Loading Alertmanager configuration" />}
      <Stack direction="column" gap={2}>
        {amRoutes.map((route, index) => {
          const match = labelsMatchMatchers(alertLabels, route.matchers);

          return (
            <div key={index}>
              Route #{index + 1}{' '}
              <TagList
                tags={route.matchers.map(matcherToMatcherField).map((m) => `${m.name}${m.operator}${m.value}`)}
              />
              {match ? 'MATCHING LABELS FOUND!!!' : 'NO MATCHES'}
            </div>
          );
        })}
      </Stack>
    </div>
  );
}
