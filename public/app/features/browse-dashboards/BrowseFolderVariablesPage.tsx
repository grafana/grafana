import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom-v5-compat';

import { locationUtil } from '@grafana/data';
import { t, Trans } from '@grafana/i18n';
import { Alert, Button, Stack, Text } from '@grafana/ui';
import { useGetFolderQueryFacade, useUpdateFolder } from 'app/api/clients/folder/v1beta1/hooks';
import { Page } from 'app/core/components/Page/Page';

import { useListAllVariablesQuery } from '../variables-management/api';
import { VariablesTable } from '../variables-management/components/VariablesTable';
import { getVariableFolderUid } from '../variables-management/utils';

import { FolderDetailsActions } from './components/FolderDetailsActions/FolderDetailsActions';
import { useNavModel } from './hooks/useNavModel';

export function BrowseFolderVariablesPage() {
  const { uid: folderUID = '' } = useParams();
  const navigate = useNavigate();
  const { data: folderDTO, isLoading: isFolderLoading } = useGetFolderQueryFacade(folderUID);
  const [saveFolder] = useUpdateFolder();
  const navModel = useNavModel(folderDTO, 'variables');

  const { data: variables = [], isLoading: isVariablesLoading } = useListAllVariablesQuery();
  const folderVariables = useMemo(
    () => variables.filter((v) => getVariableFolderUid(v) === folderUID),
    [variables, folderUID]
  );

  // Flat list — this page is already scoped to one folder, so skip the folder parent row.
  const tree = useMemo(
    () => ({
      global: folderVariables,
      folders: [],
    }),
    [folderVariables]
  );

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

  const isLoading = isFolderLoading || isVariablesLoading;

  return (
    <Page
      navId="dashboards/browse"
      pageNav={navModel}
      onEditTitle={onEditTitle}
      actions={folderDTO && <FolderDetailsActions folderDTO={folderDTO} />}
    >
      <Page.Contents isLoading={isLoading}>
        {!folderDTO && (
          <Alert
            title={t('browse-dashboards.browse-folder-variables-page.title-folder-not-found', 'Folder not found')}
          />
        )}
        {folderDTO && (
          <Stack direction="column" gap={3}>
            <div>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Text element="h3">
                  <Trans i18nKey="browse-dashboards.folder-variables.list-heading">Folder variables</Trans>
                </Text>
                <Button
                  onClick={() =>
                    navigate(locationUtil.assureBaseUrl(`/dashboards/variables/new?folderUid=${folderUID}`))
                  }
                >
                  <Trans i18nKey="browse-dashboards.folder-variables.new">New folder variable</Trans>
                </Button>
              </Stack>
              {folderVariables.length === 0 ? (
                <Text color="secondary">
                  <Trans i18nKey="browse-dashboards.folder-variables.empty">
                    No folder-scoped variables in this folder yet.
                  </Trans>
                </Text>
              ) : (
                <VariablesTable
                  tree={tree}
                  expandedFolders={new Set()}
                  selected={new Set()}
                  onToggleFolder={() => {}}
                  onSetSelected={() => {}}
                  onEdit={(variable) => {
                    const name = variable.metadata.name;
                    if (name) {
                      navigate(locationUtil.assureBaseUrl(`/dashboards/variables/edit/${name}`));
                    }
                  }}
                />
              )}
            </div>
          </Stack>
        )}
      </Page.Contents>
    </Page>
  );
}

export default BrowseFolderVariablesPage;
