import { css } from '@emotion/css';
import React, { useState } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';

import { GrafanaTheme2, isDataFrame, SelectableValue } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2, Table, Select } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { Breadcrumb } from './Breadcrumb';
import { UploadPopoverContainer } from './UploadPopoverContainer';
import { getGrafanaStorage } from './helper';

const pathsSupportingUpload = ['resources'];
const paths = [
  'resources',
  'devenv/dev-dashboards/',
  'public-static',
  'public-static/img/bg',
  'public-static/img/icons/unicons',
  'public-static/img/icons/iot',
  'public-static/img/icons/marker',
];
const pathOptions: Array<SelectableValue<string>> = paths.map((p) => ({ label: p, value: p }));

interface RouteParams {
  path: string;
}

interface Props extends GrafanaRouteComponentProps<RouteParams> {}

export default function StoragePage(props: Props) {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const path = props.match.params.path ?? '';
  const setPath = (p: string) => {
    locationService.push({
      pathname: ('/org/storage/' + p).replace('//', '/'),
    });
  };

  // TODO: remove this. It's currently used as a workaround to close the popover
  const [_, setUploadModalCloseTime] = useState(Date.now());

  // TODO: remove. used as a workaround to refresh the table after uploading a file
  const [uploadTime, setUploadTime] = useState(Date.now());

  const files = useAsync(() => {
    return getGrafanaStorage()
      .list(path)
      .then((frame) => {
        if (frame) {
          const name = frame.fields[0];
          frame.fields[0] = {
            ...name,
            getLinks: (cfg) => {
              return [
                {
                  title: 'Open XYZ',
                  href: '#open',
                  target: '_self',
                  origin: name,
                  onClick: () => {
                    const n = name.values.get(cfg.valueRowIndex ?? 0);
                    setPath(path + '/' + n);
                  },
                },
              ];
            },
          };
        }
        return frame;
      });
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
            options={pathOptions}
            value={path}
            onChange={(v) => {
              if (typeof v.value === 'string') {
                setPath(v.value);
              }
            }}
          />
          {pathsSupportingUpload.includes(path) && (
            <div className={styles.uploadSpot}>
              {
                <UploadPopoverContainer
                  onUpload={() => {
                    setUploadTime(Date.now);
                  }}
                  onClose={() => {
                    setUploadModalCloseTime(Date.now);
                  }}
                />
              }
            </div>
          )}
        </div>
        <div>
          <Breadcrumb pathName={path} onPathChange={setPath} />
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
});
