import { css } from '@emotion/css';
import React, { useCallback, useState } from 'react';

import { DataSourceInstanceSettings, DataSourceJsonData, DataSourceRef, GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes';
import { Button } from '../Button';
import { Card } from '../Card/Card';
import CustomScrollbar from '../CustomScrollbar/CustomScrollbar';
import { Drawer } from '../Drawer/Drawer';
import { FileDropzone, FileDropzoneDefaultChildren } from '../FileDropzone';
import { Input } from '../Input/Input';
import { ModalsController } from '../Modal/ModalsContext';
import { PluginSignatureBadge } from '../PluginSignatureBadge/PluginSignatureBadge';
import { Tag } from '../Tags/Tag';

import { DatasourceDrawerProps, DatasourceSelectProps } from './types';

export function DatasourceSelect(props: DatasourceSelectProps) {
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
          <DataSourceDisplay ds={current}></DataSourceDisplay>
        </Button>
      )}
    </ModalsController>
  );
}

function DataSourceDisplay(props: {
  ds: DataSourceInstanceSettings<DataSourceJsonData> | string | DataSourceRef | null | undefined;
}) {
  const { ds: ds } = props;
  const styles = useStyles2(getStyles);

  if (!ds) {
    return <span>Unknown</span>;
  }

  if (typeof ds === 'string') {
    return <span>${ds} - not found</span>;
  }

  if ('name' in ds) {
    return (
      <>
        <img className={styles.pickerDSLogo} alt={`${ds.meta.name} logo`} src={ds.meta.info.logos.small}></img>
        <span>{ds.name}</span>
      </>
    );
  }

  return <span>{ds.uid} - not found</span>;
}

export function PickerContent(props: DatasourceDrawerProps) {
  const { onChange, children, fileUploadOptions, onDismiss } = props;
  const changeCallback = useCallback(
    (ds: string) => {
      onChange(ds);
    },
    [onChange]
  );
  const [filterTerm, onFilterChange] = useState<string>('');
  const styles = useStyles2(getStyles);

  return (
    <Drawer
      closeOnMaskClick={true}
      onClose={() => {
        onDismiss();
      }}
    >
      <div className={styles.drawerContent}>
        <div className={styles.filterContainer}>
          <Input
            onChange={
              (e) => {
                onFilterChange(e.currentTarget.value);
              } /* useCallback */
            }
            value={filterTerm}
          ></Input>
        </div>
        <div className={styles.dataSourceList}>
          <CustomScrollbar>
            {props.datasources //TODO: break this out
              .filter((ds) => ds.name.toLocaleLowerCase().indexOf(filterTerm.toLocaleLowerCase()) !== -1)
              .map((ds) => {
                return (
                  <Card key={ds.uid} onClick={() => changeCallback(ds.uid)}>
                    <Card.Figure>
                      <img alt={`${ds.meta.name} logo`} src={ds.meta.info.logos.large}></img>
                    </Card.Figure>
                    <Card.Meta>
                      {[
                        ds.meta.name,
                        ds.url,
                        ds.isDefault && <Tag key="default-tag" name={'default'} colorIndex={1} />,
                      ]}
                    </Card.Meta>
                    <Card.Tags>
                      <PluginSignatureBadge status={ds.meta.signature} />
                    </Card.Tags>
                    <Card.Heading>{ds.name}</Card.Heading>
                  </Card>
                );
              })}
          </CustomScrollbar>
        </div>
        <div className={styles.additionalContent}>{children}</div>
        <div className={styles.additionalContent}>
          <FileDropzone
            readAs="readAsArrayBuffer"
            fileListRenderer={() => undefined}
            options={{
              ...fileUploadOptions,
              onDrop: (a, f, e) => {
                onDismiss();
                if (fileUploadOptions?.onDrop) {
                  fileUploadOptions.onDrop(a, f, e);
                }
              },
            }}
          >
            <FileDropzoneDefaultChildren primaryText={'Upload file'} />
          </FileDropzone>
        </div>
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
    pickerDSLogo: css`
      height: 20px;
      width: 20px;
      margin-right: ${theme.spacing(1)};
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
