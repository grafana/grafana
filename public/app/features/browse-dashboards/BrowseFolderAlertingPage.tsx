import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';
import { buildNavModel, getAlertingTabID } from 'app/features/folders/state/navModel';

import { AlertsFolderView } from '../alerting/unified/AlertsFolderView';
import { alertRuleApi } from '../alerting/unified/api/alertRuleApi';
import { GRAFANA_RULER_CONFIG } from '../alerting/unified/api/featureDiscoveryApi';
import { stringifyErrorLike } from '../alerting/unified/utils/misc';
import { rulerRuleType } from '../alerting/unified/utils/rules';

import { FolderActionsButton } from './components/FolderActionsButton';

const { useRulerNamespaceQuery } = alertRuleApi;

export function BrowseFolderAlertingPage() {
  const { uid: folderUID = '' } = useParams();
  const { data: folderDTO, isLoading: isFolderLoading } = useGetFolderQueryFacade(folderUID);

  const {
    data: rulerNamespace = {},
    isLoading: isRulerNamespaceLoading,
    error: rulerNamespaceError,
  } = useRulerNamespaceQuery({
    rulerConfig: GRAFANA_RULER_CONFIG,
    namespace: folderUID,
  });

  const [saveFolder] = useUpdateFolder();

  const navModel = useMemo(() => {
    if (!folderDTO) {
      return undefined;
    }
    const model = buildNavModel(folderDTO);

    // Set the "Alerting" tab to active
    const alertingTabID = getAlertingTabID(folderDTO.uid);
    const alertingTab = model.children?.find((child) => child.id === alertingTabID);
    if (alertingTab) {
      alertingTab.active = true;
    }
    return model;
  }, [folderDTO]);

  const onEditTitle = folderUID
    ? async (newValue: string) => {
        if (folderDTO) {
          const result = await saveFolder({
            ...folderDTO,
            title: newValue,
          });
          if ('error' in result) {
            throw result.error;
          }
        }
      }
    : undefined;

  const isLoading = isFolderLoading || isRulerNamespaceLoading;
  const folderRules = Object.values(rulerNamespace)
    .flatMap((group) => group)
    .flatMap((group) => group.rules)
    .filter(rulerRuleType.grafana.rule);

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={onEditTitle}
      actions={<>{folderDTO && <FolderActionsButton folder={folderDTO} />}</>}
    >
      <Page.Contents isLoading={isLoading}>
        {!folderDTO && (
          <Alert
            title={t('browse-dashboards.browse-folder-alerting-page.title-folder-not-found', 'Folder not found')}
          />
        )}
        {!!rulerNamespaceError && (
          <Alert
            title={t('browse-dashboards.browse-folder-alerting-page.title-ruler-namespace-error', 'Cannot load rules')}
            severity="error"
          >
            {stringifyErrorLike(rulerNamespaceError)}
          </Alert>
        )}
        {folderDTO && <AlertsFolderView folder={folderDTO} rules={folderRules} />}
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderAlertingPage;
