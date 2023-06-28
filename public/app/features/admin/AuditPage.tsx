import React, { useEffect } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { HorizontalGroup, Pagination, VerticalGroup } from '@grafana/ui';
import { StoreState } from 'app/types';

import { Page } from '../../core/components/Page/Page';

import { AuditRecordsTable } from './audit/AuditRecordsTable';
import { loadAuditRecords } from './audit/state/actions';
import { getAuditRecords } from './audit/state/selectors';
import { changePage } from './state/actions';

function mapStateToProps(state: StoreState) {
  return {
    records: getAuditRecords(state.records),
    searchQuery: getAuditRecords(state.records),
    page: state.records.page,
    totalPages: state.records.totalPages,
    perPage: state.records.perPage,
    isLoading: state.records.isLoading,
  };
}

const mapDispatchToProps = {
  loadAuditRecords,
  changePage,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type Props = ConnectedProps<typeof connector>;

const selectors = e2eSelectors.pages.AuditRecordListPage.AuditRecordsListPage;

export const AuditRecordsListPageUnconnected = ({
  records,
  page,
  totalPages,
  isLoading,
  loadAuditRecords,
  changePage,
}: Props): JSX.Element => {
  useEffect(() => {
    loadAuditRecords();
  }, [loadAuditRecords]);

  const renderTable = () => {
    return (
      <VerticalGroup spacing="md" data-testid={selectors.container}>
        <AuditRecordsTable records={records} />
        <HorizontalGroup justify="flex-end">
          <Pagination onNavigate={changePage} currentPage={page} numberOfPages={totalPages} hideWhenSinglePage={true} />
        </HorizontalGroup>
      </VerticalGroup>
    );
  };

  return <Page.Contents isLoading={!isLoading}>{isLoading && renderTable()}</Page.Contents>;
};

const AuditRecordsListPageContent = connector(AuditRecordsListPageUnconnected);

export default function UserListPage() {
  return (
    <Page navId={'audit'}>
      <AuditRecordsListPageContent />
    </Page>
  );
}
