import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
// *** Feature Tracking
// import { reportInteraction } from '@grafana/runtime';
import { Button, Card, Collapse, InlineLabel, Input, Modal, MultiSelect, Select, useStyles2 } from '@grafana/ui';

import { PrometheusDatasource } from '../../datasource';
import { getMetadataHelp, getMetadataType } from '../../language_provider';
import { promQueryModeller } from '../PromQueryModeller';
import { PromVisualQuery } from '../types';

type Props = {
  datasource: PrometheusDatasource;
  isOpen: boolean;
  query: PromVisualQuery;
  onClose: () => void;
  onChange: (query: PromVisualQuery) => void;
};

type MetricsData = MetricData[];

type MetricData = {
  value: string;
  type?: string;
  description?: string;
};

type PromTypeOption = {
  type: string;
  description: string;
};

const functions = ['rate', 'sum', 'histogram_quatile'];

const promTypes: PromTypeOption[] = [
  {
    type: 'counter',
    description:
      'A cumulative metric that represents a single monotonically increasing counter whose value can only increase or be reset to zero on restart.',
  },
  {
    type: 'gauge',
    description: 'A metric that represents a single numerical value that can arbitrarily go up and down.',
  },
  {
    type: 'histogram',
    description:
      'A histogram samples observations (usually things like request durations or response sizes) and counts them in configurable buckets.',
  },
  {
    type: 'summary',
    description:
      'A summary samples observations (usually things like request durations and response sizes) and can calculate configurable quantiles over a sliding time window.',
  },
];

export const DEFAULT_RESULTS_PER_PAGE = 10;

export const MetricEncyclopediaModal = (props: Props) => {
  const { datasource, isOpen, onClose, onChange, query } = props;

  // metric list
  const [metrics, setMetrics] = useState<MetricsData>([]);
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  // pagination
  const [resultsPerPage, setResultsPerPage] = useState<number>(DEFAULT_RESULTS_PER_PAGE);
  const [pageNum, setPageNum] = useState<number>(1);

  // filters
  const [selectedTypes, setSelectedTypes] = useState<Array<SelectableValue<string>>>([]);

  const updateMetricsMetadata = useCallback(async () => {
    // *** Loading Gif?
    // Makes sure we loaded the metadata for metrics. Usually this is done in the start() method of the provider but we
    // don't use it with the visual builder and there is no need to run all the start() setup anyway.
    if (!datasource.languageProvider.metricsMetadata) {
      await datasource.languageProvider.loadMetricsMetadata();
    }

    // Error handling for when metrics metadata returns as undefined
    // *** There will be no metadata filtering if this happens
    // *** only metrics filter and pagination !!!
    if (!datasource.languageProvider.metricsMetadata) {
      datasource.languageProvider.metricsMetadata = {};
    }

    // filter by adding the query.labels to the search?
    // *** do this in the filter???
    let metrics;
    if (query.labels.length > 0) {
      const expr = promQueryModeller.renderLabels(query.labels);
      metrics = (await datasource.languageProvider.getSeries(expr, true))['__name__'] ?? [];
    } else {
      metrics = (await datasource.languageProvider.getLabelValues('__name__')) ?? [];
    }

    setMetrics(
      metrics.map((m) => ({
        value: m,
        type: getMetadataType(m, datasource.languageProvider.metricsMetadata!),
        description: getMetadataHelp(m, datasource.languageProvider.metricsMetadata!),
      }))
    );
  }, [datasource.languageProvider, query]);

  useEffect(() => {
    updateMetricsMetadata();
  }, [updateMetricsMetadata]);

  const styles = useStyles2(getStyles);

  const functionOptions: SelectableValue[] = functions.map((f: string) => {
    return {
      value: f,
      label: f,
    };
  });

  const typeOptions: SelectableValue[] = promTypes.map((t: PromTypeOption) => {
    return {
      value: t.type,
      label: t.type,
      description: t.description,
    };
  });

  function calculatePageList(metrics: MetricsData, resultsPerPage: number) {
    if (!metrics.length) {
      return [];
    }

    const calcResultsPerPage: number = resultsPerPage === 0 ? 1 : resultsPerPage;

    const pages = Math.floor(filterMetrics(metrics).length / calcResultsPerPage) + 1;

    return [...Array(pages).keys()].map((i) => i + 1);
  }

  function sliceMetrics(metrics: MetricsData, pageNum: number, resultsPerPage: number) {
    const calcResultsPerPage: number = resultsPerPage === 0 ? 1 : resultsPerPage;
    const start: number = pageNum === 1 ? 0 : (pageNum - 1) * calcResultsPerPage;
    const end: number = start + calcResultsPerPage;
    return metrics.slice(start, end);
  }

  function filterMetrics(metrics: MetricsData): MetricsData {
    let filteredMetrics: MetricsData = metrics;

    // filter by type
    if (selectedTypes.length > 0) {
      // *** INCLUDE UN-TYPED METRICS
      filteredMetrics = metrics.filter((m: MetricData) => {
        const matchesSelectedType = selectedTypes.some((t) => t.value === m.type);
        const missingTypeMetadata = !m.type;

        return matchesSelectedType || missingTypeMetadata;
      });
    }

    return filteredMetrics;
  }

  // *** Filtering: some metrics have no metadata so cannot be filtered

  return (
    <Modal
      data-testid={testIds.metricModal}
      isOpen={isOpen}
      title="Select Metric"
      onDismiss={onClose}
      aria-label="Metric Encyclopedia"
    >
      <div className={styles.spacing}>Search metrics by type, function, labels and alphabetically.</div>
      <div className="gf-form">
        {/* *** IMPLEMENT FUZZY SEARCH */}
        <InlineLabel width={10} className="query-keyword">
          Search
        </InlineLabel>
        <Input
          data-testid={testIds.searchMetric}
          placeholder="search query"
          value={''}
          onChange={(e) => {
            // *** Filter by text in name, description or type
          }}
          onBlur={() => {
            // *** Filter by text
          }}
        />
      </div>
      <div className="gf-form">
        <InlineLabel width={10} className="query-keyword">
          Type:
        </InlineLabel>
        <MultiSelect
          data-testid={testIds.searchType}
          options={typeOptions}
          value={selectedTypes}
          placeholder="select type"
          onChange={(v) => {
            // *** Filter by type
            // *** always include metrics without metadata but label it as unknown type
            // Consider tabs select instead of actual select or multi select
            setSelectedTypes(v);
            setPageNum(1);
          }}
        />

        <InlineLabel width={10} className="query-keyword">
          Functions:
        </InlineLabel>
        <Select
          data-testid={testIds.searchMetric}
          options={functionOptions}
          value={''}
          placeholder="select functions"
          onChange={() => {
            // *** Filter by functions(query patterns) available for certain types
            // Consider tabs select instead of actual select
          }}
        />
      </div>
      <div className="gf-form">
        <InlineLabel width={10} className="query-keyword">
          Page
        </InlineLabel>
        <Select
          data-testid={testIds.searchPage}
          options={calculatePageList(metrics, resultsPerPage).map((p) => {
            return { value: p, label: '' + p };
          })}
          value={pageNum ?? 1}
          placeholder="select page"
          onChange={(e) => {
            const value = e.value ?? 1;
            setPageNum(value);
          }}
        />
        <InlineLabel width={10} className="query-keyword">
          # per page
        </InlineLabel>
        <Input
          data-testid={testIds.resultsPerPage}
          value={resultsPerPage ?? 10}
          placeholder="results per page"
          onInput={(e) => {
            const value = +e.currentTarget.value;

            if (isNaN(value)) {
              return;
            }

            setResultsPerPage(value);
          }}
        />
      </div>
      <div className={styles.center}>A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z</div>
      {metrics &&
        sliceMetrics(filterMetrics(metrics), pageNum, resultsPerPage).map((metric: MetricData, idx) => {
          return (
            <Collapse
              aria-label={`open and close ${metric.value} query starter card`}
              data-testid={testIds.metricCard}
              key={metric.value}
              label={metric.value}
              isOpen={openTabs.includes(metric.value)}
              collapsible={true}
              onToggle={() =>
                setOpenTabs((tabs) =>
                  // close tab if it's already open, otherwise open it
                  tabs.includes(metric.value) ? tabs.filter((t) => t !== metric.value) : [...tabs, metric.value]
                )
              }
            >
              <div className={styles.cardsContainer}>
                <Card className={styles.card}>
                  <Card.Description>
                    {metric.description && metric.type ? (
                      <>
                        Type: <i>{metric.type}</i>
                        <br />
                        Description: <i>{metric.description}</i>
                      </>
                    ) : (
                      <i>No metadata available</i>
                    )}
                  </Card.Description>
                  <Card.Actions>
                    {/* *** Make selecting a metric easier, consider click on text */}
                    <Button
                      size="sm"
                      aria-label="use this metric button"
                      data-testid={testIds.useMetric}
                      onClick={() => {
                        onChange({ ...query, metric: metric.value });
                        onClose();
                      }}
                    >
                      Use this metric
                    </Button>
                  </Card.Actions>
                </Card>
              </div>
            </Collapse>
          );
        })}
      <Button aria-label="close metric encyclopedia modal" variant="secondary" onClick={onClose}>
        Close
      </Button>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    cardsContainer: css`
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: space-between;
    `,
    spacing: css`
      margin-bottom: ${theme.spacing(1)};
    `,
    center: css`
      text-align: center;
      padding: 10px;
    `,
    card: css`
      width: 100%;
      display: flex;
      flex-direction: column;
    `,
    rawQueryContainer: css`
      flex-grow: 1;
    `,
    rawQuery: css`
      background-color: ${theme.colors.background.primary};
      padding: ${theme.spacing(1)};
      margin-top: ${theme.spacing(1)};
    `,
  };
};

export const testIds = {
  metricModal: 'metric-modal',
  searchMetric: 'search-metric',
  searchType: 'search-type',
  searchFunction: 'search-function',
  metricCard: 'metric-card',
  useMetric: 'use-metric',
  searchPage: 'search-page',
  resultsPerPage: 'results-per-page',
};
