import { compact, debounce } from 'lodash';
import { useEffect, useRef } from 'react';

import { Stack, Text } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { alertRuleApi } from 'app/features/alerting/unified/api/alertRuleApi';
import { AlertQuery } from 'app/types/unified-alerting-dto';

import { Folder, KBObjectArray } from '../../../types/rule-form';
import { useGetAlertManagerDataSourcesByPermissionAndConfig } from '../../../utils/datasource';

import NotificationPreviewByAlertManager from './NotificationPreviewByAlertManager';

interface NotificationPreviewProps {
  customLabels: KBObjectArray;
  alertQueries: AlertQuery[];
  condition: string | null;
  folder?: Folder;
  alertName?: string;
  alertUid?: string;
}

const usePreview = alertRuleApi.endpoints.preview.useMutation;

// TODO the scroll position keeps resetting when we preview
// this is to be expected because the list of routes dissapears as we start the request but is very annoying
export const NotificationPreview = ({
  alertQueries,
  customLabels,
  condition,
  folder,
  alertName,
  alertUid,
}: NotificationPreviewProps) => {
  const [triggerPreview, { data = [], isLoading }] = usePreview();
  const canPreview = Boolean(folder && condition);

  // make a debounced version of the preview function so we don't call the API on each keystroke (when updating rule name for example)
  const handlePreview = useRef(debounce(triggerPreview, 500, { leading: true }));

  // potential instances are the instances that are going to be routed to the notification policies
  // convert data to list of labels: are the representation of the potential instances
  const potentialInstances = compact(data.flatMap((label) => label?.labels));

  // try previewing when the component mounts and when dependencies are updated
  useEffect(() => {
    if (!folder || !condition) {
      return;
    }

    handlePreview.current({
      alertQueries: alertQueries,
      condition: condition,
      customLabels: customLabels,
      folder: folder,
      // send a preview alert name if the user hasn't set one yet.
      alertName: alertName || '__preview_alert_name__',
      alertUid: alertUid,
    });
  }, [alertQueries, condition, customLabels, folder, alertName, alertUid, canPreview, handlePreview]);

  //  Get alert managers's data source information
  const alertManagerDataSources = useGetAlertManagerDataSourcesByPermissionAndConfig('notification');
  const onlyOneAM = alertManagerDataSources.length === 1;

  if (!canPreview) {
    return (
      <Text color="secondary" variant="bodySmall" italic>
        Conditions for previewing haven't been met yet, select a folder to continue.
      </Text>
    );
  }

  // @TODO make the loading a bit nicer with loading skeletons
  if (isLoading) {
    return (
      <Text color="secondary" variant="bodySmall">
        <Trans i18nKey="alerting.common.loading">Loading...</Trans>
      </Text>
    );
  }

  return (
    <Stack direction="column" gap={2}>
      {alertManagerDataSources.map((alertManagerSource) => (
        <NotificationPreviewByAlertManager
          alertManagerSource={alertManagerSource}
          potentialInstances={potentialInstances}
          onlyOneAM={onlyOneAM}
          key={alertManagerSource.name}
        />
      ))}
    </Stack>
  );
};

export default NotificationPreview;
