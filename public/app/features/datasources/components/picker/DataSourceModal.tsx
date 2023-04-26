import { css } from '@emotion/css';
import { once } from 'lodash';
import React, { useState } from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import {
  Modal,
  FileDropzone,
  FileDropzoneDefaultChildren,
  CustomScrollbar,
  LinkButton,
  useStyles2,
  Input,
  Icon,
} from '@grafana/ui';
import { config } from 'app/core/config';
import { ROUTES as CONNECTIONS_ROUTES } from 'app/features/connections/constants';
import * as DFImport from 'app/features/dataframe-import';
import { DATASOURCES_ROUTES } from 'app/features/datasources/constants';

import { DataSourceList } from './DataSourceList';

const INTERACTION_EVENT_NAME = 'dashboards_dspickermodal_clicked';
const INTERACTION_ITEM = {
  SELECT_DS: 'select_ds',
  UPLOAD_FILE: 'upload_file',
  CONFIG_NEW_DS: 'config_new_ds',
  SEARCH: 'search',
  DISMISS: 'dismiss',
};

interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  recentlyUsed?: string[];
  enableFileUpload?: boolean;
  fileUploadOptions?: DropzoneOptions;
  reportedInteractionFrom?: string;
}

export function DataSourceModal({
  enableFileUpload,
  fileUploadOptions,
  onChange,
  current,
  onDismiss,
  reportedInteractionFrom,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');
  const analyticsInteractionSrc = reportedInteractionFrom || 'modal';
  const newDataSourceURL = config.featureToggles.dataConnectionsConsole
    ? CONNECTIONS_ROUTES.DataSourcesNew
    : DATASOURCES_ROUTES.New;

  const onDismissModal = () => {
    onDismiss();
    reportInteraction(INTERACTION_EVENT_NAME, { item: INTERACTION_ITEM.DISMISS, src: analyticsInteractionSrc });
  };
  const onChangeDataSource = (ds: DataSourceInstanceSettings) => {
    onChange(ds);
    reportInteraction(INTERACTION_EVENT_NAME, {
      item: INTERACTION_ITEM.SELECT_DS,
      ds_type: ds.type,
      src: analyticsInteractionSrc,
    });
  };
  // Memoizing to keep once() cached so it avoids reporting multiple times
  const reportSearchUsageOnce = React.useMemo(
    () =>
      once(() => {
        reportInteraction(INTERACTION_EVENT_NAME, { item: 'search', src: analyticsInteractionSrc });
      }),
    [analyticsInteractionSrc]
  );

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismissModal}
      onDismiss={onDismissModal}
    >
      <div className={styles.leftColumn}>
        <Input
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder="Search data source"
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            reportSearchUsageOnce();
          }}
        />
        <CustomScrollbar>
          <DataSourceList
            dashboard={false}
            mixed={false}
            variables
            filter={(ds) => ds.name.includes(search) && !ds.meta.builtIn}
            onChange={onChangeDataSource}
            current={current}
          />
        </CustomScrollbar>
      </div>
      <div className={styles.rightColumn}>
        <div className={styles.builtInDataSources}>
          <DataSourceList
            className={styles.builtInDataSourceList}
            filter={(ds) => !!ds.meta.builtIn}
            dashboard
            mixed
            onChange={onChangeDataSource}
            current={current}
          />
          {enableFileUpload && (
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                maxSize: DFImport.maxFileSize,
                multiple: false,
                accept: DFImport.acceptedFiles,
                ...fileUploadOptions,
                onDrop: (...args) => {
                  fileUploadOptions?.onDrop?.(...args);
                  onDismiss();
                  reportInteraction(INTERACTION_EVENT_NAME, {
                    item: INTERACTION_ITEM.UPLOAD_FILE,
                    src: analyticsInteractionSrc,
                  });
                },
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.dsCTAs}>
          <LinkButton
            variant="secondary"
            href={newDataSourceURL}
            onClick={() => {
              reportInteraction(INTERACTION_EVENT_NAME, {
                item: INTERACTION_ITEM.CONFIG_NEW_DS,
                src: analyticsInteractionSrc,
              });
            }}
          >
            Configure a new data source
          </LinkButton>
        </div>
      </div>
    </Modal>
  );
}

function getDataSourceModalStyles(theme: GrafanaTheme2) {
  return {
    modal: css`
      width: 80%;
      height: 80%;
      max-width: 1200px;
      max-height: 900px;
    `,
    modalContent: css`
      display: flex;
      flex-direction: row;
      height: 100%;
    `,
    leftColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      padding-right: ${theme.spacing(4)};
      border-right: 1px solid ${theme.colors.border.weak};
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(4)};
    `,
    builtInDataSources: css`
      flex: 1;
      margin-bottom: ${theme.spacing(4)};
    `,
    builtInDataSourceList: css`
      margin-bottom: ${theme.spacing(4)};
    `,
    dsCTAs: css`
      display: flex;
      flex-direction: row;
      width: 100%;
      justify-content: flex-end;
    `,
    searchInput: css`
      width: 100%;
      min-height: 32px;
      margin-bottom: ${theme.spacing(1)};
    `,
  };
}
