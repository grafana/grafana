import { css } from '@emotion/css';
import React from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data/src';
import { Button, ButtonCascader, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
  onDismiss: () => void;
};

export const QueryEditorDrawerHeader = ({ savedQuery, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  const deleteQuery = async () => {
    await getSavedQuerySrv().deleteSavedQuery({ uid: savedQuery.uid });
    onDismiss();
  };

  const useQueryOptions = () => {
    return [
      { label: 'Create dashboard panel', value: 'dashboard-panel', icon: 'apps' },
      { label: 'Create alert rule in Alert Manager', value: 'alert-rule', icon: 'bell' },
      { label: 'Use in explore', value: 'explore', icon: 'compass' },
      { label: 'Create incident in Grafana OnCall', value: 'incident-oncall', icon: 'compass' },
      { label: 'Create incident in Grafana Incident', value: 'incident-incident', icon: 'compass' },
      { label: 'Explore logs', value: 'incident-incident', icon: 'compass' },
    ];
  };

  return (
    <HorizontalGroup justify={'space-between'}>
      <h1>{savedQuery.title}</h1>
      <HorizontalGroup>
        <Button icon="times" size="sm" variant={'secondary'} onClick={onDismiss}>
          Close
        </Button>
        <ButtonCascader
          options={useQueryOptions()}
          variant="secondary"
          icon={'grafana'}
          buttonProps={{ className: styles.cascaderButton }}
        >
          Use query
        </ButtonCascader>
        <Button icon="sync" size="sm" variant={'secondary'}>
          Run
        </Button>
        {/*<Button icon="share-alt" size="sm" variant={'secondary'}>Export</Button>*/}
        <Button icon="lock" size="sm" variant={'secondary'} />
        <Button size="sm" variant={'primary'}>
          Save
        </Button>
        <Button icon="trash-alt" size="sm" variant={'destructive'} onClick={deleteQuery} />
      </HorizontalGroup>
    </HorizontalGroup>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    cascaderButton: css`
      height: 24px;
    `,
  };
};
