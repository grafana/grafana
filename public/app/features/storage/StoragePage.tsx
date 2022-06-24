import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { DisplayProcessor, getValueFormat, GrafanaTheme2, isDataFrame, SelectableValue } from '@grafana/data';
import { useStyles2, Table, Select } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';

import { UploadPopoverContainer } from './UploadPopoverContainer';
import { getGrafanaStorage } from './helper';

const bytesFormatter = getValueFormat('bytes');
const bytesDisplayProcessor: DisplayProcessor = (v) => ({ ...bytesFormatter(v, 2), numeric: NaN });
const textDisplayProcessor: DisplayProcessor = (v) => ({ text: `${v}`, numeric: NaN });

const pathsSupportingUpload = ['resources'];
const paths = [
  'resources',
  'public-static',
  'public-static/img/bg',
  'public-static/img/icons/unicons',
  'public-static/img/icons/iot',
  'public-static/img/icons/marker',
];
const pathOptions: Array<SelectableValue<string>> = paths.map((p) => ({ label: p, value: p }));

export default function StoragePage() {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const [path, setPath] = useState('resources'); // from URL?

  // TODO: remove this. It's currently used as a workaround to close the popover
  const [_, setUploadModalCloseTime] = useState(Date.now());

  // TODO: remove. used as a workaround to refresh the table after uploading a file
  const [uploadTime, setUploadTime] = useState(Date.now());

  const files = useAsync(async () => {
    const listResult = await getGrafanaStorage().list(path);
    if (isDataFrame(listResult)) {
      listResult.fields = listResult.fields.map((f) => {
        switch (f.name) {
          case 'name':
            return {
              ...f,
              name: 'Filename',
              display: textDisplayProcessor,
            };
          case 'mediaType':
            return {
              ...f,
              name: 'File type',
              display: textDisplayProcessor,
            };
          case 'size':
            return {
              ...f,
              display: bytesDisplayProcessor,
              name: 'Size',
            };
          default:
            return f;
        }
      });
    }

    return listResult;
  }, [path, uploadTime]);

  const renderTable = () => {
    const dataFrame = files.value;
    if (!isDataFrame(dataFrame)) {
      return <></>;
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.tableControlRowWrapper}>
          <Select
            className={styles.tableControlRowItem}
            options={pathOptions}
            value={path}
            onChange={(v) => {
              if (typeof v.value === 'string') {
                setPath(v.value);
              }
            }}
          />
          <div className={styles.tableControlRowItem}>
            {
              <UploadPopoverContainer
                disabled={!pathsSupportingUpload.includes(path)}
                onUpload={() => {
                  setUploadTime(Date.now);
                }}
                onClose={() => {
                  setUploadModalCloseTime(Date.now);
                }}
              />
            }
          </div>
        </div>
        <div className={styles.tableWrapper}>
          <AutoSizer>
            {({ width, height }) => (
              <div style={{ width: `${width}px`, height: `${height}px` }}>
                <Table
                  height={height}
                  width={width}
                  data={dataFrame}
                  noHeader={false}
                  showTypeIcons={false}
                  resizable={false}
                />
              </div>
            )}
          </AutoSizer>
        </div>
      </div>
    );
  };

  return (
    <Page navModel={navModel}>
      <Page.Contents isLoading={files.loading}>{renderTable()}</Page.Contents>
    </Page>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  // TODO: remove `height: 90%`
  wrapper: css`
    display: flex;
    flex-direction: column;
    height: 90%;
  `,
  tableControlRowWrapper: css`
    display: flex;
    flex-direction: row;
    align-items: center;
  `,
  // TODO: remove `height: 100%`
  tableWrapper: css`
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
  tableControlRowItem: css`
    margin: ${theme.spacing(2)};
  `,
  tableSelect: css`
    border: 1px solid ${theme.colors.border.medium};
  `,
  border: css`
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
});
