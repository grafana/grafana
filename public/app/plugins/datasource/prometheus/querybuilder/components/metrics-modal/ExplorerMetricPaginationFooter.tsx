import { css } from '@emotion/css';
import React from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Input, Pagination, useTheme2 } from '@grafana/ui/src';

import { testIds } from './MetricsModal';
import { calculatePageList, calculateResultsPerPage } from './state/helpers';
import { DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE, MetricsModalState } from './state/state';

export const ExplorerMetricPaginationFooter = (props: {
  state: MetricsModalState;
  onNavigate: (val: number) => void;
  onInput: (e: React.FormEvent<HTMLInputElement>) => void;
}) => {
  const theme = useTheme2();

  const { state } = props;
  const styles = getStyles(theme, state.disableTextWrap);

  // const styles = {
  //   resultsFooter: css``;
  //   resultsAmount: css``;
  //   resultsPerPageWrapper: css``;
  //   resultsPerPageLabel: css``;
  // }
  return (
    <div className={styles.resultsFooter}>
      <div className={styles.resultsAmount}>
        Showing {props.state.filteredMetricCount} of {props.state.totalMetricCount} results
      </div>
      <Pagination
        currentPage={props.state.pageNum ?? 1}
        numberOfPages={calculatePageList(props.state).length}
        onNavigate={props.onNavigate}
      />
      <div className={styles.resultsPerPageWrapper}>
        <p className={styles.resultsPerPageLabel}># Results per page&nbsp;</p>
        <Input
          data-testid={testIds.resultsPerPage}
          value={calculateResultsPerPage(
            props.state.resultsPerPage,
            DEFAULT_RESULTS_PER_PAGE,
            MAXIMUM_RESULTS_PER_PAGE
          )}
          placeholder="results per page"
          width={10}
          title={'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE}
          type="number"
          onInput={props.onInput}
        />
      </div>
    </div>
  );
};

export const getStyles = (theme: GrafanaTheme2, disableTextWrap: boolean) => {
  return {
    resultsAmount: css`
      color: ${theme.colors.text.secondary};
      font-size: 0.85rem;
      padding: 0 0 4px 0;
    `,
    resultsFooter: css`
      margin-top: 24px;
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      position: sticky;
    `,
    resultsPerPageLabel: css`
      color: ${theme.colors.text.secondary};
      opacity: 75%;
      padding-top: 5px;
      font-size: 0.85rem;
      margin-right: 8px;
    `,
    resultsPerPageWrapper: css`
      display: flex;
    `,
  };
};
