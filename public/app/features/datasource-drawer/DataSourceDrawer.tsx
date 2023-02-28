import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef, GrafanaTheme2 } from '@grafana/data';
import {
  Button,
  CustomScrollbar,
  Drawer,
  FileDropzone,
  FileDropzoneDefaultChildren,
  Input,
  ModalsController,
  useStyles2,
} from '@grafana/ui';

import { DataSourceCard } from './components/DataSourceCard';
import { DataSourceDisplay } from './components/DataSourceDisplay';
import { PickerContentProps, DataSourceDrawerProps } from './types';

export function DataSourceDrawer(props: DataSourceDrawerProps) {
  const { current, onChange } = props;
  const styles = useStyles2(getStyles);

  return (
    <ModalsController>
      {({ showModal, hideModal }) => (
        <Button
          className={styles.picker}
          onClick={() => {
            showModal(PickerContent, {
              ...props,
              onDismiss: hideModal,
              onChange: (ds) => {
                onChange(ds);
                hideModal();
              },
            });
          }}
        >
          <DataSourceDisplay dataSource={current}></DataSourceDisplay>
        </Button>
      )}
    </ModalsController>
  );
}

function PickerContent(props: PickerContentProps) {
  const { datasources, enableFileUpload, recentlyUsed = [], onChange, fileUploadOptions, onDismiss, current } = props;
  const changeCallback = useCallback(
    (ds: string) => {
      onChange(ds);
    },
    [onChange]
  );

  const [filterTerm, onFilterChange] = useState<string>('');
  const styles = useStyles2(getStyles);

  const filteredDataSources = datasources.filter((ds) => {
    return ds?.name.toLocaleLowerCase().indexOf(filterTerm.toLocaleLowerCase()) !== -1;
  });

  return (
    <Drawer closeOnMaskClick={true} onClose={onDismiss}>
      <div className={styles.drawerContent}>
        <div className={styles.filterContainer}>
          <Input
            onChange={(e) => {
              onFilterChange(e.currentTarget.value);
            }}
            value={filterTerm}
          ></Input>
        </div>
        <div className={styles.dataSourceList}>
          <CustomScrollbar>
            {recentlyUsed
              .map((uid) => filteredDataSources.find((ds) => ds.uid === uid))
              .map((ds) => {
                if (!ds) {
                  return null;
                }
                return (
                  <DataSourceCard
                    selected={isDataSourceMatch(ds, current)}
                    key={ds.uid}
                    ds={ds}
                    onChange={changeCallback}
                  />
                );
              })}
            {recentlyUsed && recentlyUsed.length > 0 && <hr />}
            {filteredDataSources.map((ds) => (
              <DataSourceCard
                selected={isDataSourceMatch(ds, current)}
                key={ds.uid}
                ds={ds}
                onChange={changeCallback}
              />
            ))}
          </CustomScrollbar>
        </div>
        {enableFileUpload && (
          <div className={styles.additionalContent}>
            <FileDropzone
              readAs="readAsArrayBuffer"
              fileListRenderer={() => undefined}
              options={{
                ...fileUploadOptions,
                onDrop: (...args) => {
                  onDismiss();
                  fileUploadOptions?.onDrop?.(...args);
                },
              }}
            >
              <FileDropzoneDefaultChildren primaryText={'Upload file'} />
            </FileDropzone>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    drawerContent: css`
      display: flex;
      flex-direction: column;
      height: 100%;
    `,
    picker: css`
      background: ${theme.colors.background.secondary};
    `,
    filterContainer: css`
      padding-bottom: ${theme.spacing(1)};
    `,
    dataSourceList: css`
      height: 50px;
      flex-grow: 1;
    `,
    additionalContent: css`
      padding-top: ${theme.spacing(1)};
    `,
  };
}

export function isDataSourceMatch(
  ds: DataSourceInstanceSettings<DataSourceJsonData> | undefined,
  current: string | DataSourceInstanceSettings<DataSourceJsonData> | DataSourceRef | null | undefined
): boolean | undefined {
  if (!ds) {
    return false;
  }
  if (!current) {
    return false;
  }
  if (typeof current === 'string') {
    return ds.uid === current;
  }
  return ds.uid === current.uid;
}
