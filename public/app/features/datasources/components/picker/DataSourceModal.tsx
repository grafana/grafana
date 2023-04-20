import { css } from '@emotion/css';
import React, { useState } from 'react';
import { DropzoneOptions } from 'react-dropzone';

import { DataSourceInstanceSettings, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
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
import * as DFImport from 'app/features/dataframe-import';

import { DataSourceList } from './DataSourceList';

interface DataSourceModalProps {
  onChange: (ds: DataSourceInstanceSettings) => void;
  current: DataSourceRef | string | null | undefined;
  onDismiss: () => void;
  datasources?: DataSourceInstanceSettings[];
  recentlyUsed?: string[];
  enableFileUpload?: boolean;
  fileUploadOptions?: DropzoneOptions;
}

export function DataSourceModal({
  enableFileUpload,
  fileUploadOptions,
  onChange,
  current,
  onDismiss,
}: DataSourceModalProps) {
  const styles = useStyles2(getDataSourceModalStyles);
  const [search, setSearch] = useState('');

  return (
    <Modal
      title="Select data source"
      closeOnEscape={true}
      closeOnBackdropClick={true}
      isOpen={true}
      className={styles.modal}
      contentClassName={styles.modalContent}
      onClickBackdrop={onDismiss}
      onDismiss={onDismiss}
    >
      <div className={styles.leftColumn}>
        <Input
          className={styles.searchInput}
          value={search}
          prefix={<Icon name="search" />}
          placeholder="Search data source"
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
        <CustomScrollbar>
          <DataSourceList
            dashboard={false}
            mixed={false}
            // FIXME: Filter out the grafana data source in a hacky way
            filter={(ds) => ds.name.includes(search)}
            onChange={onChange}
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
            onChange={onChange}
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
                },
              }}
            >
              <FileDropzoneDefaultChildren />
            </FileDropzone>
          )}
        </div>
        <div className={styles.dsCTAs}>
          <LinkButton variant="secondary" href={`datasources/new`}>
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
      padding-right: ${theme.spacing(1)};
      border-right: 1px solid ${theme.colors.border.weak};
    `,
    rightColumn: css`
      display: flex;
      flex-direction: column;
      width: 50%;
      height: 100%;
      justify-items: space-evenly;
      align-items: stretch;
      padding-left: ${theme.spacing(1)};
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
