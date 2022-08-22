import { css } from '@emotion/css';
import { negate } from 'lodash';
import React, { ComponentProps, memo, useCallback, useMemo, useState } from 'react';
import { CellProps, SortByFn } from 'react-table';

import { GrafanaTheme2 } from '@grafana/data';
import { Badge, Button, DeleteButton, HorizontalGroup, LoadingPlaceholder, useStyles2, Alert } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { AccessControlAction } from 'app/types';

import { AddCorrelationForm } from './Forms/AddCorrelationForm';
import { EditCorrelationForm } from './Forms/EditCorrelationForm';
import { EmptyCorrelationsCTA } from './components/EmptyCorrelationsCTA';
import { Column, Table } from './components/Table';
import { CorrelationData, useCorrelations } from './useCorrelations';

const sortDatasource: SortByFn<CorrelationData> = (a, b, column) =>
  a.values[column].name.localeCompare(b.values[column].name);

const isSourceReadOnly = ({ source }: Pick<CorrelationData, 'source'>) => source.readOnly;

const loaderWrapper = css`
  display: flex;
  justify-content: center;
`;

export default function CorrelationsPage() {
  const navModel = useNavModel('correlations');
  const [isAdding, setIsAdding] = useState(false);
  const { correlations, create, remove, update, isLoading, error } = useCorrelations();
  const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  const handleAdd = useCallback<ComponentProps<typeof AddCorrelationForm>['onSubmit']>(
    async (correlation) => {
      await create(correlation);
      setIsAdding(false);
    },
    [create]
  );

  const RowActions = useCallback(
    ({
      row: {
        original: {
          source: { uid: sourceUID, readOnly },
          uid,
        },
      },
    }: CellProps<CorrelationData, void>) =>
      !readOnly && (
        <DeleteButton aria-label="delete correlation" onConfirm={() => remove({ sourceUID, uid })} closeOnConfirm />
      ),
    [remove]
  );

  const columns = useMemo<Array<Column<CorrelationData>>>(
    () => [
      {
        cell: InfoCell,
        shrink: true,
        visible: (data) => data.some(isSourceReadOnly),
      },
      {
        id: 'source',
        header: 'Source',
        cell: DataSourceCell,
        sortType: sortDatasource,
      },
      {
        id: 'target',
        header: 'Target',
        cell: DataSourceCell,
        sortType: sortDatasource,
      },
      { id: 'label', header: 'Label', sortType: 'alphanumeric' },
      {
        cell: RowActions,
        shrink: true,
        visible: (data) => canWriteCorrelations && data.some(negate(isSourceReadOnly)),
      },
    ],
    [RowActions, canWriteCorrelations]
  );

  const data = useMemo(() => correlations, [correlations]);

  const showEmptyListCTA = data?.length === 0 && !isAdding && (!error || error.status === 404);

  const showErrorAlert = error && error.status !== 404;

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <div>
          <HorizontalGroup justify="space-between">
            <div>
              <h4>Correlations</h4>
              <p>Define how data living in different data sources relates to each other.</p>
            </div>
            {canWriteCorrelations && data?.length !== 0 && data !== undefined && !isAdding && (
              <Button icon="plus" onClick={() => setIsAdding(true)}>
                Add new
              </Button>
            )}
          </HorizontalGroup>
        </div>

        {!data && isLoading && (
          <div className={loaderWrapper}>
            <LoadingPlaceholder text="loading..." />
          </div>
        )}

        {showEmptyListCTA && <EmptyCorrelationsCTA onClick={() => setIsAdding(true)} />}

        {
          // This error is not actionable, it'd be nice to have a recovery button
          showErrorAlert && (
            <Alert severity="error" title="Error fetching correlation data" topSpacing={2}>
              <HorizontalGroup>
                {error.data.message || 'An unknown error occurred while fetching correlation data. Please try again.'}
              </HorizontalGroup>
            </Alert>
          )
        }

        {isAdding && <AddCorrelationForm onClose={() => setIsAdding(false)} onSubmit={handleAdd} />}

        {data && data.length >= 1 && (
          <Table
            renderExpandedRow={({ target, source, ...correlation }) => (
              <EditCorrelationForm
                defaultValues={{ sourceUID: source.uid, ...correlation }}
                onSubmit={update}
                readOnly={isSourceReadOnly({ source }) || !canWriteCorrelations}
              />
            )}
            columns={columns}
            data={data}
            getRowId={(correlation) => `${correlation.source.uid}-${correlation.uid}`}
          />
        )}
      </Page.Contents>
    </Page>
  );
}

const getDatasourceCellStyles = (theme: GrafanaTheme2) => ({
  root: css`
    display: flex;
    align-items: center;
  `,
  dsLogo: css`
    margin-right: ${theme.spacing()};
    height: 16px;
    width: 16px;
  `,
});

const DataSourceCell = memo(
  function DataSourceCell({
    cell: { value },
  }: CellProps<CorrelationData, CorrelationData['source'] | CorrelationData['target']>) {
    const styles = useStyles2(getDatasourceCellStyles);

    return (
      <span className={styles.root}>
        <img src={value.meta.info.logos.small} className={styles.dsLogo} />
        {value.name}
      </span>
    );
  },
  ({ cell: { value } }, { cell: { value: prevValue } }) => {
    return value.type === prevValue.type && value.name === prevValue.name;
  }
);

const noWrap = css`
  white-space: nowrap;
`;

const InfoCell = memo(
  function InfoCell({ ...props }: CellProps<CorrelationData, void>) {
    const readOnly = props.row.original.source.readOnly;

    if (readOnly) {
      return <Badge text="Read only" color="purple" className={noWrap} />;
    } else {
      return null;
    }
  },
  (props, prevProps) => props.row.original.source.readOnly === prevProps.row.original.source.readOnly
);
