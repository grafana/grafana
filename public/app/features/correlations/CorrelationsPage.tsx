import { css } from '@emotion/css';
import { negate } from 'lodash';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { DataSourceInstanceSettings, GrafanaTheme2 } from '@grafana/data';
import { isFetchError, reportInteraction } from '@grafana/runtime';
import {
  Badge,
  Button,
  DeleteButton,
  LoadingPlaceholder,
  useStyles2,
  Alert,
  InteractiveTable,
  type Column,
  type CellProps,
  type SortByFn,
  Pagination,
  Icon,
} from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/core';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { Trans, t } from 'app/core/internationalization';
import { AccessControlAction } from 'app/types';

import { AddCorrelationForm } from './Forms/AddCorrelationForm';
import { EditCorrelationForm } from './Forms/EditCorrelationForm';
import { EmptyCorrelationsCTA } from './components/EmptyCorrelationsCTA';
import type { Correlation, RemoveCorrelationParams } from './types';
import { CorrelationData, useCorrelations } from './useCorrelations';

const sortDatasource: SortByFn<CorrelationData> = (a, b, column) =>
  a.values[column].name.localeCompare(b.values[column].name);

const isCorrelationsReadOnly = (correlation: CorrelationData) => correlation.provisioned;

const loaderWrapper = css({
  display: 'flex',
  justifyContent: 'center',
});

export default function CorrelationsPage() {
  const navModel = useNavModel('correlations');
  const [isAdding, setIsAddingValue] = useState(false);
  const page = useRef(1);

  const setIsAdding = (value: boolean) => {
    setIsAddingValue(value);
    if (value) {
      reportInteraction('grafana_correlations_adding_started');
    }
  };

  const {
    remove,
    get: { execute: fetchCorrelations, ...get },
  } = useCorrelations();

  const canWriteCorrelations = contextSrv.hasPermission(AccessControlAction.DataSourcesWrite);

  const handleAdded = useCallback(() => {
    reportInteraction('grafana_correlations_added');
    fetchCorrelations({ page: page.current });
    setIsAdding(false);
  }, [fetchCorrelations]);

  const handleUpdated = useCallback(() => {
    reportInteraction('grafana_correlations_edited');
    fetchCorrelations({ page: page.current });
  }, [fetchCorrelations]);

  const handleDelete = useCallback(
    async (params: RemoveCorrelationParams, isLastRow: boolean) => {
      await remove.execute(params);
      reportInteraction('grafana_correlations_deleted');

      if (isLastRow) {
        page.current--;
      }
      fetchCorrelations({ page: page.current });
    },
    [remove, fetchCorrelations]
  );

  useEffect(() => {
    fetchCorrelations({ page: page.current });
  }, [fetchCorrelations]);

  const RowActions = useCallback(
    ({
      row: {
        index,
        original: {
          source: { uid: sourceUID },
          provisioned,
          uid,
        },
      },
    }: CellProps<CorrelationData, void>) => {
      return (
        !provisioned && (
          <DeleteButton
            aria-label={t('correlations.list.delete', 'delete correlation')}
            onConfirm={() =>
              handleDelete({ sourceUID, uid }, page.current > 1 && index === 0 && data?.correlations.length === 1)
            }
            closeOnConfirm
          />
        )
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleDelete]
  );

  const columns = useMemo<Array<Column<CorrelationData>>>(
    () => [
      {
        id: 'info',
        cell: InfoCell,
        disableGrow: true,
        visible: (data) => data.some(isCorrelationsReadOnly),
      },
      {
        id: 'source',
        header: t('correlations.list.source', 'Source'),
        cell: DataSourceCell,
        sortType: sortDatasource,
      },
      {
        id: 'target',
        header: t('correlations.list.target', 'Target'),
        cell: DataSourceCell,
        sortType: sortDatasource,
      },
      { id: 'label', header: t('correlations.list.label', 'Label'), sortType: 'alphanumeric' },
      {
        id: 'actions',
        cell: RowActions,
        disableGrow: true,
        visible: (data) => canWriteCorrelations && data.some(negate(isCorrelationsReadOnly)),
      },
    ],
    [RowActions, canWriteCorrelations]
  );

  const data = useMemo(() => get.value, [get.value]);
  const showEmptyListCTA = data?.correlations.length === 0 && !isAdding && !get.error;
  const addButton = canWriteCorrelations && data?.correlations?.length !== 0 && data !== undefined && !isAdding && (
    <Button icon="plus" onClick={() => setIsAdding(true)}>
      <Trans i18nKey="correlations.add-new">Add new</Trans>
    </Button>
  );

  return (
    <Page
      navModel={navModel}
      subTitle={
        <>
          <Trans i18nKey="correlations.sub-title">
            Define how data living in different data sources relates to each other. Read more in the{' '}
            <a
              href="https://grafana.com/docs/grafana/next/administration/correlations/"
              target="_blank"
              rel="noreferrer"
            >
              documentation
              <Icon name="external-link-alt" />
            </a>
          </Trans>
        </>
      }
      actions={addButton}
    >
      <Page.Contents>
        <div>
          {!data && get.loading && (
            <div className={loaderWrapper}>
              <LoadingPlaceholder text={t('correlations.list.loading', 'loading...')} />
            </div>
          )}

          {showEmptyListCTA && (
            <EmptyCorrelationsCTA canWriteCorrelations={canWriteCorrelations} onClick={() => setIsAdding(true)} />
          )}

          {
            // This error is not actionable, it'd be nice to have a recovery button
            get.error && (
              <Alert
                severity="error"
                title={t('correlations.alert.title', 'Error fetching correlation data')}
                topSpacing={2}
              >
                {(isFetchError(get.error) && get.error.data?.message) ||
                  t(
                    'correlations.alert.error-message',
                    'An unknown error occurred while fetching correlation data. Please try again.'
                  )}
              </Alert>
            )
          }

          {isAdding && <AddCorrelationForm onClose={() => setIsAdding(false)} onCreated={handleAdded} />}

          {data && data.correlations.length >= 1 && (
            <>
              <InteractiveTable
                renderExpandedRow={(correlation) => (
                  <ExpendedRow
                    correlation={correlation}
                    onUpdated={handleUpdated}
                    readOnly={isCorrelationsReadOnly(correlation) || !canWriteCorrelations}
                  />
                )}
                columns={columns}
                data={data.correlations}
                getRowId={(correlation) => `${correlation.source.uid}-${correlation.uid}`}
              />
              <Pagination
                currentPage={page.current}
                numberOfPages={Math.ceil(data.totalCount / data.limit)}
                onNavigate={(toPage: number) => {
                  fetchCorrelations({ page: (page.current = toPage) });
                }}
              />
            </>
          )}
        </div>
      </Page.Contents>
    </Page>
  );
}

interface ExpandedRowProps {
  correlation: CorrelationData;
  readOnly: boolean;
  onUpdated: () => void;
}
function ExpendedRow({ correlation: { source, ...correlation }, readOnly, onUpdated }: ExpandedRowProps) {
  useEffect(
    () => reportInteraction('grafana_correlations_details_expanded'),
    // we only want to fire this on first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  let corr: Correlation =
    correlation.type === 'query'
      ? { ...correlation, type: 'query', sourceUID: source.uid, targetUID: correlation.target.uid }
      : { ...correlation, type: 'external', sourceUID: source.uid };

  return <EditCorrelationForm correlation={corr} onUpdated={onUpdated} readOnly={readOnly} />;
}

const getDatasourceCellStyles = (theme: GrafanaTheme2) => ({
  root: css({
    display: 'flex',
    alignItems: 'center',
  }),
  dsLogo: css({
    marginRight: theme.spacing(),
    height: '16px',
    width: '16px',
  }),
});

const DataSourceCell = memo(
  function DataSourceCell({ cell: { value } }: CellProps<CorrelationData, DataSourceInstanceSettings>) {
    const styles = useStyles2(getDatasourceCellStyles);

    return (
      <span className={styles.root}>
        {value?.name !== undefined && (
          <>
            <img src={value.meta.info.logos.small} alt="" className={styles.dsLogo} />
            {value.name}
          </>
        )}
      </span>
    );
  },
  ({ cell: { value } }, { cell: { value: prevValue } }) => {
    return value?.type === prevValue?.type && value?.name === prevValue?.name;
  }
);

const noWrap = css({
  whiteSpace: 'nowrap',
});

const InfoCell = memo(
  function InfoCell({ ...props }: CellProps<CorrelationData, void>) {
    const readOnly = props.row.original.provisioned;

    if (readOnly) {
      return <Badge text={t('correlations.list.read-only', 'Read only')} color="purple" className={noWrap} />;
    } else {
      return null;
    }
  },
  (props, prevProps) => props.row.original.source.readOnly === prevProps.row.original.source.readOnly
);
