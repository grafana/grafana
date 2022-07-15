import { css } from '@emotion/css';
import React, { useMemo, useState } from 'react';
import { FileRejection } from 'react-dropzone';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2, isDataFrame, ValueLinkConfig } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';
import { useStyles2, IconName, Spinner, TabsBar, Tab, Button, HorizontalGroup, LinkButton, Alert } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { Page } from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { ShowConfirmModalEvent } from 'app/types/events';

import { AddRootView } from './AddRootView';
import { Breadcrumb } from './Breadcrumb';
import { CreateNewFolderModal } from './CreateNewFolderModal';
import { ExportView } from './ExportView';
import { FileView } from './FileView';
import { FolderView } from './FolderView';
import { RootView } from './RootView';
import { UploadModal } from './UploadModal';
import { getGrafanaStorage, filenameAlreadyExists } from './storage';
import { StorageView, UploadReponse } from './types';

interface RouteParams {
  path: string;
}

interface QueryParams {
  view: StorageView;
}

const folderNameRegex = /^[a-z\d!\-_.*'() ]+$/;
const folderNameMaxLength = 256;

interface Props extends GrafanaRouteComponentProps<RouteParams, QueryParams> {}

const getParentPath = (path: string) => {
  const lastSlashIdx = path.lastIndexOf('/');
  if (lastSlashIdx < 1) {
    return '';
  }

  return path.substring(0, lastSlashIdx);
};

export default function StoragePage(props: Props) {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const path = props.match.params.path ?? '';
  const view = props.queryParams.view ?? StorageView.Data;
  const setPath = (p: string, view?: StorageView) => {
    let url = ('/admin/storage/' + p).replace('//', '/');
    if (view && view !== StorageView.Data) {
      url += '?view=' + view;
    }
    locationService.push(url);
  };

  const [isAddingNewFolder, setIsAddingNewFolder] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [errorMessages, setErrorMessages] = useState<string[]>([]);

  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage()
      .list(path)
      .then((frame) => {
        if (frame) {
          const name = frame.fields[0];
          frame.fields[0] = {
            ...name,
            getLinks: (cfg: ValueLinkConfig) => {
              const n = name.values.get(cfg.valueRowIndex ?? 0);
              const p = path + '/' + n;
              return [
                {
                  title: `Open ${n}`,
                  href: `/admin/storage/${p}`,
                  target: '_self',
                  origin: name,
                  onClick: () => {
                    setPath(p);
                  },
                },
              ];
            },
          };
        }
        return frame;
      });
  }, [path]);

  const onUpload = (rsp: UploadReponse) => {
    console.log('Uploaded: ' + path);
    if (rsp.path) {
      setPath(rsp.path);
    } else {
      setPath(path); // back to data
    }
  };

  const doUpload = async (acceptedFile: File, overwriteExistingFile: boolean) => {
    if (!acceptedFile) {
      setErrorMessages(['Please select a file.']);
      return;
    }

    const rsp = await getGrafanaStorage().upload(path, acceptedFile, overwriteExistingFile);
    if (rsp.status !== 200) {
      setErrorMessages([rsp.message]);
    } else {
      onUpload(rsp);
    }
  };

  const isFolder = useMemo(() => {
    let isFolder = path?.indexOf('/') < 0;
    if (listing.value) {
      const length = listing.value.length;
      if (length === 1) {
        const first = listing.value.fields[0].values.get(0) as string;
        isFolder = !path.endsWith(first);
      } else {
        // TODO: handle files/folders which do not exist
        isFolder = true;
      }
    }
    return isFolder;
  }, [path, listing]);

  const fileNames = useMemo(() => {
    return (
      listing.value?.fields
        ?.find((f) => f.name === 'name')
        ?.values?.toArray()
        ?.filter((v) => typeof v === 'string') ?? []
    );
  }, [listing]);

  const renderView = () => {
    const isRoot = !path?.length || path === '/';
    switch (view) {
      case StorageView.Export:
        if (!isRoot) {
          setPath('');
          return <Spinner />;
        }
        return <ExportView onPathChange={setPath} />;

      case StorageView.AddRoot:
        if (!isRoot) {
          setPath('');
          return <Spinner />;
        }
        return <AddRootView onPathChange={setPath} />;
    }

    const frame = listing.value;
    if (!isDataFrame(frame)) {
      return <></>;
    }

    if (isRoot) {
      return <RootView root={frame} onPathChange={setPath} />;
    }

    const opts = [{ what: StorageView.Data, text: 'Data' }];

    // Root folders have a config page
    if (path.indexOf('/') < 0) {
      opts.push({ what: StorageView.Config, text: 'Configure' });
    }

    // Lets only apply permissions to folders (for now)
    if (isFolder) {
      opts.push({ what: StorageView.Perms, text: 'Permissions' });
    } else {
      // TODO: only if the file exists in a storage engine with
      opts.push({ what: StorageView.History, text: 'History' });
    }

    const canAddFolder = isFolder && path.startsWith('resources');
    const canDelete = path.startsWith('resources/');
    const canViewDashboard =
      path.startsWith('devenv/') && config.featureToggles.dashboardsFromStorage && (isFolder || path.endsWith('.json'));

    const onFileUpload = (acceptedFiles: File[], rejectedFiles: FileRejection[], overwriteExistingFile: boolean) => {
      const file = acceptedFiles[0];

      if (rejectedFiles.length > 0) {
        setErrors(rejectedFiles);
        return;
      }

      const filenameExists = file ? filenameAlreadyExists(file.name, fileNames) : false;
      if (file && filenameExists && !overwriteExistingFile) {
        setErrorMessages([`${file.name} already exists`]);
        return;
      }

      doUpload(file, overwriteExistingFile).then((r) => {});
    };

    const setErrors = (rejectedFiles: FileRejection[]) => {
      let errors: string[] = [];
      rejectedFiles.map((rejectedFile) => {
        rejectedFile.errors.map((error: FileRejection) => {
          if (errors.indexOf(error.message) === -1) {
            errors.push(error.message);
          }
        });
      });

      setErrorMessages(errors);
    };

    const getErrorMessages = () => {
      return (
        <div className={styles.errorAlert}>
          <Alert title="Upload failed" severity="error" onRemove={clearAlert}>
            {errorMessages.map((error) => {
              return <div key={error}>{error}</div>;
            })}
          </Alert>
        </div>
      );
    };

    const clearAlert = () => {
      setErrorMessages([]);
    };

    return (
      <div className={styles.wrapper}>
        <HorizontalGroup width="100%" justify="space-between" spacing={'md'} height={25}>
          <Breadcrumb pathName={path} onPathChange={setPath} rootIcon={navModel.node.icon as IconName} />
          <HorizontalGroup>
            {canViewDashboard && (
              <LinkButton icon="dashboard" href={`g/${path}`}>
                Dashboard
              </LinkButton>
            )}
            <Button onClick={() => setShowUploadModal(true)}>Upload</Button>
            {canAddFolder && <Button onClick={() => setIsAddingNewFolder(true)}>New Folder</Button>}
            {canDelete && (
              <Button
                variant="destructive"
                onClick={() => {
                  const text = isFolder
                    ? 'Are you sure you want to delete this folder and all its contents?'
                    : 'Are you sure you want to delete this file?';

                  const parentPath = getParentPath(path);
                  appEvents.publish(
                    new ShowConfirmModalEvent({
                      title: `Delete ${isFolder ? 'folder' : 'file'}`,
                      text,
                      icon: 'trash-alt',
                      yesText: 'Delete',
                      onConfirm: () =>
                        getGrafanaStorage()
                          .delete({ path, isFolder })
                          .then(() => {
                            setPath(parentPath);
                          }),
                    })
                  );
                }}
              >
                Delete
              </Button>
            )}
          </HorizontalGroup>
        </HorizontalGroup>

        {errorMessages.length > 0 && getErrorMessages()}

        <TabsBar>
          {opts.map((opt) => (
            <Tab
              key={opt.what}
              label={opt.text}
              active={opt.what === view}
              onChangeTab={() => setPath(path, opt.what)}
            />
          ))}
        </TabsBar>
        {isFolder ? (
          <FolderView path={path} listing={frame} onPathChange={setPath} view={view} fileNames={fileNames} />
        ) : (
          <FileView path={path} listing={frame} onPathChange={setPath} view={view} />
        )}

        {showUploadModal && <UploadModal onDismiss={() => setShowUploadModal(false)} onFileUpload={onFileUpload} />}

        {isAddingNewFolder && (
          <CreateNewFolderModal
            onSubmit={async ({ folderName }) => {
              const folderPath = `${path}/${folderName}`;
              const res = await getGrafanaStorage().createFolder(folderPath);
              if (typeof res?.error !== 'string') {
                setPath(folderPath);
                setIsAddingNewFolder(false);
              }
            }}
            onDismiss={() => {
              setIsAddingNewFolder(false);
            }}
            validate={(folderName) => {
              const lowerCase = folderName.toLowerCase();

              if (filenameAlreadyExists(folderName, fileNames)) {
                return 'A file or a folder with the same name already exists';
              }

              if (!folderNameRegex.test(lowerCase)) {
                return 'Name contains illegal characters';
              }

              if (folderName.length > folderNameMaxLength) {
                return `Name is too long, maximum length: ${folderNameMaxLength} characters`;
              }

              return true;
            }}
          />
        )}
      </div>
    );
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={listing.loading}>{renderView()}</Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // TODO: remove `height: 90%`
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
  tableControlRowWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.spacing(2)};
  `,
  // TODO: remove `height: 100%`
  tableWrapper: css`
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
  uploadSpot: css`
    margin-left: ${theme.spacing(2)};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
  errorAlert: css`
    padding-top: 20px;
  `,
});
