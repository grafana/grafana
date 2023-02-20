import { css } from '@emotion/css';
import React, { useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2, SelectableValue } from '@grafana/data';
// *** Feature Tracking
// import { reportInteraction } from '@grafana/runtime';
import { Button, Card, Collapse, InlineLabel, Input, Modal, Select, useStyles2 } from '@grafana/ui';

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

export const MetricEncyclopediaModal = (props: Props) => {
  const { datasource, isOpen, onClose, onChange, query } = props;
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  const [metrics, setMetrics] = useState<MetricsData>([]);

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

  const functions = ['rate', 'sum', 'histogram_quatile'];

  const promTypes = ['counter', 'gauge', 'histogram', 'summary'];

  const functionOptions: SelectableValue[] = functions.map((f: string) => {
    return {
      value: f,
      label: f,
    };
  });

  const typeOptions: SelectableValue[] = promTypes.map((t: string) => {
    return {
      value: t,
      label: t,
    };
  });

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
        <Select
          data-testid={testIds.searchType}
          options={typeOptions}
          value={''}
          placeholder="select type"
          onChange={() => {
            // *** Filter by type
            // *** always include metrics without metadata but label it as unknown type
            // Consider tabs select instead of actual select
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
          options={[1, 2, 3, 4, 5, 6].map((p) => {
            return { value: p, label: '' + p };
          })}
          value={1}
          placeholder="select page"
          onChange={() => {
            // *** select page
            // *** add select amount per page
          }}
        />
      </div>
      <div className={styles.center}>A|B|C|D|E|F|G|H|I|J|K|L|M|N|O|P|Q|R|S|T|U|V|W|X|Y|Z</div>
      {metrics &&
        metrics.map((metric: MetricData, idx) => {
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
};
