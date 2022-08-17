import { css } from '@emotion/css';
import React, { useState } from 'react';

import { DataQuery, GrafanaTheme2 } from '@grafana/data/src';
import { Button, ButtonCascader, HorizontalGroup, useStyles2 } from '@grafana/ui';

import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';

import { QueryName } from './QueryName';

type Props = {
  savedQuery: SavedQuery<DataQuery>;
  onDismiss: () => void;
};

export const QueryEditorDrawerHeader = ({ savedQuery, onDismiss }: Props) => {
  const styles = useStyles2(getStyles);

  const [queryName, setQueryName] = useState(savedQuery.title);

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

  // @TODO update when Save is implemented
  const onQueryNameChange = (name: string) => {
    setQueryName(name);
    savedQuery.title = name;
  };

  return (
    <div className={styles.header}>
      <HorizontalGroup justify={'space-between'}>
        <QueryName name={queryName} onChange={onQueryNameChange} />
        <HorizontalGroup>
          <Button icon="times" size="sm" variant={'secondary'} onClick={onDismiss} autoFocus={false}>
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
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    cascaderButton: css`
      height: 24px;
    `,
    header: css`
      padding-top: 5px;
      padding-bottom: 15px;
    `,
  };
};
