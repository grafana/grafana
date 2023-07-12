import cx from 'classnames';
import React, { FormEvent } from 'react';

import { SelectableValue } from '@grafana/data/src';
import {
  Button,
  ButtonGroup,
  Icon,
  Input,
  MultiSelect,
  Pagination,
  Spinner,
  Toggletip,
  useTheme2,
} from '@grafana/ui/src';

import { PromVisualQuery } from '../../types';

import { testIds } from './MetricsModal';
import { ResultsTable } from './ResultsTable';
import { calculatePageList, calculateResultsPerPage, placeholders } from './state/helpers';
import { DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE, MetricsModalState } from './state/state';
import { getStyles } from './styles';
import { MetricData } from './types';

export const MetricsWrapper = (props: {
  searchCallback: (query: string, fullMetaSearchVal: boolean) => void;
  options: SelectableValue[];
  content: JSX.Element;
  query: PromVisualQuery;
  onChange: (query: PromVisualQuery) => void;
  onClose: () => void;
  state: MetricsModalState;
  onFuzzySearchQuery: (e: FormEvent<HTMLInputElement>) => void;
  onSetSelectedTypes: (v: SelectableValue[]) => void;
  onShowAdditionalSettings: () => void;
  displayedMetrics: MetricData[];
  onNavigate: (val: number) => void;
  onChangePageNumber: (e: FormEvent<HTMLInputElement>) => void;
  clearQuery: () => void;
}) => {
  const theme = useTheme2();

  const { state } = props;
  const styles = getStyles(theme, state.disableTextWrap);

  return (
    <>
      <div className={styles.inputWrapper}>
        <div className={cx(styles.inputItem, styles.inputItemFirst)}>
          <Input
            autoFocus={true}
            data-testid={testIds.searchMetric}
            placeholder={placeholders.browse}
            value={state.fuzzySearchQuery}
            onInput={props.onFuzzySearchQuery}
          />
        </div>
        {state.hasMetadata && (
          <div className={styles.inputItem}>
            <MultiSelect
              data-testid={testIds.selectType}
              inputId="my-select"
              options={props.options}
              value={state.selectedTypes}
              placeholder={placeholders.type}
              onChange={props.onSetSelectedTypes}
            />
          </div>
        )}
        <div>
          <Spinner className={`${styles.loadingSpinner} ${state.isLoading ? styles.visible : ''}`} />
        </div>
        <div className={styles.inputItem}>
          <Toggletip
            aria-label="Additional settings"
            content={props.content}
            placement="bottom-end"
            closeButton={false}
          >
            <ButtonGroup className={styles.settingsBtn}>
              <Button
                variant="secondary"
                size="md"
                onClick={props.onShowAdditionalSettings}
                data-testid={testIds.showAdditionalSettings}
                className={styles.noBorder}
              >
                Additional Settings
              </Button>
              <Button
                className={styles.noBorder}
                variant="secondary"
                icon={state.showAdditionalSettings ? 'angle-up' : 'angle-down'}
              />
            </ButtonGroup>
          </Toggletip>
        </div>
      </div>
      <div className={styles.resultsData}>
        {props.query.metric && <i className={styles.currentlySelected}>Currently selected: {props.query.metric}</i>}
        {props.query.labels.length > 0 && (
          <div className={styles.resultsDataFiltered}>
            <Icon name="info-circle" size="sm" />
            <div className={styles.resultsDataFilteredText}>
              &nbsp;These metrics have been pre-filtered by labels chosen in the label filters.
            </div>
          </div>
        )}
      </div>
      <div className={styles.results}>
        {state.metrics && (
          <ResultsTable
            metrics={props.displayedMetrics}
            onChange={props.onChange}
            onClose={props.onClose}
            query={props.query}
            state={state}
            disableTextWrap={state.disableTextWrap}
          />
        )}
      </div>
      <div className={styles.resultsFooter}>
        <div className={styles.resultsAmount}>
          Showing {state.filteredMetricCount} of {state.totalMetricCount} results
        </div>
        <Pagination
          currentPage={state.pageNum ?? 1}
          numberOfPages={calculatePageList(state).length}
          onNavigate={props.onNavigate}
        />
        <div className={styles.resultsPerPageWrapper}>
          <p className={styles.resultsPerPageLabel}># Results per page&nbsp;</p>
          <Input
            data-testid={testIds.resultsPerPage}
            value={calculateResultsPerPage(state.resultsPerPage, DEFAULT_RESULTS_PER_PAGE, MAXIMUM_RESULTS_PER_PAGE)}
            placeholder="results per page"
            width={10}
            title={'The maximum results per page is ' + MAXIMUM_RESULTS_PER_PAGE}
            type="number"
            onInput={props.onChangePageNumber}
          />
        </div>
        <div>
          <Button onClick={props.clearQuery}>Clear</Button>
        </div>
      </div>
    </>
  );
};
