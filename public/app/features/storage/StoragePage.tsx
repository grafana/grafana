import { css } from '@emotion/css';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';

import { DataFrame, GrafanaTheme2, isDataFrame, ValueLinkConfig } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { useStyles2, IconName, Spinner } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { AddRootView } from './AddRootView';
import { Breadcrumb } from './Breadcrumb';
import { ExportView } from './ExportView';
import { FolderView } from './FolderView';
import { RootView } from './RootView';
import { getGrafanaStorage } from './helper';
import { StorageView } from './types';

interface RouteParams {
  path: string;
}

interface QueryParams {
  view: StorageView;
}

interface Props extends GrafanaRouteComponentProps<RouteParams, QueryParams> {}

export default function StoragePage(props: Props) {
  const styles = useStyles2(getStyles);
  const navModel = useNavModel('storage');
  const path = props.match.params.path ?? '';
  const view = props.queryParams.view ?? StorageView.Data;
  const setPath = (p: string) => {
    locationService.push(('/admin/storage/' + p).replace('//', '/'));
  };
  const setView = (s: StorageView) => {
    locationService.push(location.pathname + '?view=' + s);
  };

  const listing = useAsync((): Promise<DataFrame | undefined> => {
    return getGrafanaStorage()
      .list(path)
      .then((frame) => {
        if (frame) {
          const name = frame.fields[0];
          frame.fields[0] = {
            ...name,
            getLinks: (cfg: ValueLinkConfig) => {
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
  }, [path]);

  const isFolder = useMemo(() => {
    let isFolder = path?.indexOf('/') < 0;
    if (listing.value) {
      const length = listing.value.length;
      if (length > 1) {
        isFolder = true;
      }
      if (length === 1) {
        const first = listing.value.fields[0].values.get(0) as string;
        isFolder = !path.endsWith(first);
      }
    }
    return isFolder;
  }, [path, listing]);

  const renderView = () => {
    const isRoot = !path?.length || path === '/';
    switch (view) {
      case StorageView.Export:
        if (!isRoot) {
          setPath('');
          return <Spinner />;
        }
        return <ExportView />;

      case StorageView.AddRoot:
        if (!isRoot) {
          setPath('');
          return <Spinner />;
        }
        return <AddRootView />;
    }

    const frame = listing.value;
    if (!isDataFrame(frame)) {
      return <></>;
    }

    if (isRoot) {
      return <RootView root={frame} onPathChange={setPath} setView={setView} />;
    }

    return (
      <div className={styles.wrapper}>
        <div>
          <Breadcrumb pathName={path} onPathChange={setPath} rootIcon={navModel.node.icon as IconName} />
        </div>
        {isFolder ? (
          <FolderView path={path} listing={frame} onPathChange={setPath} view={view} setView={setView} />
        ) : (
          <div>FILE...</div>
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
});
