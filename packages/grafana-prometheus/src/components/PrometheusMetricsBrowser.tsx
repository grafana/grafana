// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.tsx
import { css, cx } from '@emotion/css';
import { ChangeEvent } from 'react';
import * as React from 'react';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme2, TimeRange } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  BrowserLabel as PromLabel,
  Button,
  Stack,
  Input,
  Label,
  LoadingPlaceholder,
  stylesFactory,
  withTheme2,
} from '@grafana/ui';

import PromQlLanguageProvider from '../language_provider';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../language_utils';

// Hard limit on labels to render
const EMPTY_SELECTOR = '{}';
const METRIC_LABEL = '__name__';
const LIST_ITEM_SIZE = 25;

export interface BrowserProps {
  languageProvider: PromQlLanguageProvider;
  onChange: (selector: string) => void;
  theme: GrafanaTheme2;
  autoSelect?: number;
  hide?: () => void;
  lastUsedLabels: string[];
  storeLastUsedLabels: (labels: string[]) => void;
  deleteLastUsedLabels: () => void;
  timeRange?: TimeRange;
}

interface BrowserState {
  labels: SelectableLabel[];
  labelSearchTerm: string;
  metricSearchTerm: string;
  status: string;
  error: string;
  validationStatus: string;
  valueSearchTerm: string;
  seriesLimit?: string;
}

export const DEFAULT_SERIES_LIMIT = '40000';
export const REMOVE_SERIES_LIMIT = 'none';

interface FacettableValue {
  name: string;
  selected?: boolean;
  details?: string;
}

export interface SelectableLabel {
  name: string;
  selected?: boolean;
  loading?: boolean;
  values?: FacettableValue[];
  hidden?: boolean;
  facets?: number;
}

export function buildSelector(labels: SelectableLabel[]): string {
  let singleMetric = '';
  const selectedLabels = [];
  for (const label of labels) {
    if ((label.name === METRIC_LABEL || label.selected) && label.values && label.values.length > 0) {
      const selectedValues = label.values.filter((value) => value.selected).map((value) => value.name);
      if (selectedValues.length > 1) {
        selectedLabels.push(`${label.name}=~"${selectedValues.map(escapeLabelValueInRegexSelector).join('|')}"`);
      } else if (selectedValues.length === 1) {
        if (label.name === METRIC_LABEL) {
          singleMetric = selectedValues[0];
        } else {
          selectedLabels.push(`${label.name}="${escapeLabelValueInExactSelector(selectedValues[0])}"`);
        }
      }
    }
  }
  return [singleMetric, '{', selectedLabels.join(','), '}'].join('');
}

export function facetLabels(
  labels: SelectableLabel[],
  possibleLabels: Record<string, string[]>,
  lastFacetted?: string
): SelectableLabel[] {
  return labels.map((label) => {
    const possibleValues = possibleLabels[label.name];
    if (possibleValues) {
      let existingValues: FacettableValue[];
      if (label.name === lastFacetted && label.values) {
        // Facetting this label, show all values
        existingValues = label.values;
      } else {
        // Keep selection in other facets
        const selectedValues: Set<string> = new Set(
          label.values?.filter((value) => value.selected).map((value) => value.name) || []
        );
        // Values for this label have not been requested yet, let's use the facetted ones as the initial values
        existingValues = possibleValues.map((value) => ({ name: value, selected: selectedValues.has(value) }));
      }
      return {
        ...label,
        loading: false,
        values: existingValues,
        hidden: !possibleValues,
        facets: existingValues.length,
      };
    }

    // Label is facetted out, hide all values
    return { ...label, loading: false, hidden: !possibleValues, values: undefined, facets: 0 };
  });
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrapper: css({
    backgroundColor: theme.colors.background.secondary,
    padding: theme.spacing(1),
    width: '100%',
  }),
  list: css({
    marginTop: theme.spacing(1),
    display: 'flex',
    flexWrap: 'wrap',
    maxHeight: '200px',
    overflow: 'auto',
    alignContent: 'flex-start',
  }),
  section: css({
    '& + &': {
      margin: `${theme.spacing(2)} 0`,
    },
    position: 'relative',
  }),
  selector: css({
    fontFamily: theme.typography.fontFamilyMonospace,
    marginBottom: theme.spacing(1),
  }),
  status: css({
    padding: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    /* using absolute positioning because flex interferes with ellipsis */
    position: 'absolute',
    width: '50%',
    right: 0,
    textAlign: 'right',
    opacity: 0,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 100ms linear',
    },
  }),
  statusShowing: css({
    opacity: 1,
  }),
  error: css({
    color: theme.colors.error.main,
  }),
  valueList: css({
    marginRight: theme.spacing(1),
    resize: 'horizontal',
  }),
  valueListWrapper: css({
    borderLeft: `1px solid ${theme.colors.border.medium}`,
    margin: `${theme.spacing(1)} 0`,
    padding: `${theme.spacing(1)} 0 ${theme.spacing(1)} ${theme.spacing(1)}`,
  }),
  valueListArea: css({
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: theme.spacing(1),
  }),
  valueTitle: css({
    marginLeft: `-${theme.spacing(0.5)}`,
    marginBottom: theme.spacing(1),
  }),
  validationStatus: css({
    padding: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
    color: theme.colors.text.maxContrast,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  }),
}));

/**
 * TODO #33976: Remove duplicated code. The component is very similar to LokiLabelBrowser.tsx. Check if it's possible
 *              to create a single, generic component.
 */
export class UnthemedPrometheusMetricsBrowser extends React.Component<BrowserProps, BrowserState> {
  valueListsRef = React.createRef<HTMLDivElement>();
  state: BrowserState = {
    labels: [],
    labelSearchTerm: '',
    metricSearchTerm: '',
    status: 'Ready',
    error: '',
    validationStatus: '',
    valueSearchTerm: '',
  };

  onChangeLabelSearch = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ labelSearchTerm: event.target.value });
  };

  onChangeMetricSearch = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ metricSearchTerm: event.target.value });
  };

  onChangeSeriesLimit = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ seriesLimit: event.target.value.trim() });
  };

  onChangeValueSearch = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ valueSearchTerm: event.target.value });
  };

  onClickRunQuery = () => {
    const selector = buildSelector(this.state.labels);
    this.props.onChange(selector);
  };

  onClickRunRateQuery = () => {
    const selector = buildSelector(this.state.labels);
    const query = `rate(${selector}[$__rate_interval])`;
    this.props.onChange(query);
  };

  onClickClear = () => {
    this.setState((state) => {
      const labels: SelectableLabel[] = state.labels.map((label) => ({
        ...label,
        values: undefined,
        selected: false,
        loading: false,
        hidden: false,
        facets: undefined,
      }));
      return {
        labels,
        labelSearchTerm: '',
        metricSearchTerm: '',
        status: '',
        error: '',
        validationStatus: '',
        valueSearchTerm: '',
      };
    });
    this.props.deleteLastUsedLabels();
    // Get metrics
    this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
  };

  onClickLabel = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    const label = this.state.labels.find((l) => l.name === name);
    if (!label) {
      return;
    }
    // Toggle selected state
    const selected = !label.selected;
    let nextValue: Partial<SelectableLabel> = { selected };
    if (label.values && !selected) {
      // Deselect all values if label was deselected
      const values = label.values.map((value) => ({ ...value, selected: false }));
      nextValue = { ...nextValue, facets: 0, values };
    }
    // Resetting search to prevent empty results
    this.setState({ labelSearchTerm: '' });
    this.updateLabelState(name, nextValue, '', () => this.doFacettingForLabel(name));
  };

  onClickValue = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    const label = this.state.labels.find((l) => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Resetting search to prevent empty results
    this.setState({ labelSearchTerm: '' });
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map((v) => ({ ...v, selected: v.name === value ? !v.selected : v.selected }));
    this.updateLabelState(name, { values }, '', () => this.doFacetting(name));
  };

  onClickMetric = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    // Finding special metric label
    const label = this.state.labels.find((l) => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Resetting search to prevent empty results
    this.setState({ metricSearchTerm: '' });
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map((v) => ({
      ...v,
      selected: v.name === value || v.selected ? !v.selected : v.selected,
    }));
    // Toggle selected state of special metrics label
    const selected = values.some((v) => v.selected);
    this.updateLabelState(name, { selected, values }, '', () => this.doFacetting(name));
  };

  onClickValidate = () => {
    const selector = buildSelector(this.state.labels);
    this.validateSelector(selector);
  };

  updateLabelState(name: string, updatedFields: Partial<SelectableLabel>, status = '', cb?: () => void) {
    this.setState((state) => {
      const labels: SelectableLabel[] = state.labels.map((label) => {
        if (label.name === name) {
          return { ...label, ...updatedFields };
        }
        return label;
      });
      // New status overrides errors
      const error = status ? '' : state.error;
      return { labels, status, error, validationStatus: '' };
    }, cb);
  }

  componentDidMount() {
    const { languageProvider, lastUsedLabels } = this.props;
    if (languageProvider) {
      const selectedLabels: string[] = lastUsedLabels;
      languageProvider.start(this.props.timeRange).then(() => {
        let rawLabels: string[] = languageProvider.getLabelKeys();
        // Get metrics
        this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
        // Auto-select previously selected labels
        const labels: SelectableLabel[] = rawLabels.map((label, i, arr) => ({
          name: label,
          selected: selectedLabels.includes(label),
          loading: false,
        }));
        // Pre-fetch values for selected labels
        this.setState({ labels }, () => {
          this.state.labels.forEach((label) => {
            if (label.selected) {
              this.fetchValues(label.name, EMPTY_SELECTOR);
            }
          });
        });
      });
    }
  }

  doFacettingForLabel(name: string) {
    const label = this.state.labels.find((l) => l.name === name);
    if (!label) {
      return;
    }
    const selectedLabels = this.state.labels.filter((label) => label.selected).map((label) => label.name);
    this.props.storeLastUsedLabels(selectedLabels);
    if (label.selected) {
      // Refetch values for newly selected label...
      if (!label.values) {
        this.fetchValues(name, buildSelector(this.state.labels));
      }
    } else {
      // Only need to facet when deselecting labels
      this.doFacetting();
    }
  }

  doFacetting = (lastFacetted?: string) => {
    const selector = buildSelector(this.state.labels);
    if (selector === EMPTY_SELECTOR) {
      // Clear up facetting
      const labels: SelectableLabel[] = this.state.labels.map((label) => {
        return { ...label, facets: 0, values: undefined, hidden: false };
      });
      this.setState({ labels }, () => {
        // Get fresh set of values
        this.state.labels.forEach(
          (label) => (label.selected || label.name === METRIC_LABEL) && this.fetchValues(label.name, selector)
        );
      });
    } else {
      // Do facetting
      this.fetchSeries(selector, lastFacetted);
    }
  };

  async fetchValues(name: string, selector: string) {
    const { languageProvider } = this.props;
    this.updateLabelState(name, { loading: true }, `Fetching values for ${name}`);
    try {
      let rawValues = await languageProvider.getLabelValues(name);
      // If selector changed, clear loading state and discard result by returning early
      if (selector !== buildSelector(this.state.labels)) {
        this.updateLabelState(name, { loading: false });
        return;
      }
      const values: FacettableValue[] = [];
      const { metricsMetadata } = languageProvider;
      for (const labelValue of rawValues) {
        const value: FacettableValue = { name: labelValue };
        // Adding type/help text to metrics
        if (name === METRIC_LABEL && metricsMetadata) {
          const meta = metricsMetadata[labelValue];
          if (meta) {
            value.details = `(${meta.type}) ${meta.help}`;
          }
        }
        values.push(value);
      }
      this.updateLabelState(name, { values, loading: false });
    } catch (error) {
      console.error(error);
    }
  }

  async fetchSeries(selector: string, lastFacetted?: string) {
    const { languageProvider } = this.props;
    if (lastFacetted) {
      this.updateLabelState(lastFacetted, { loading: true }, `Facetting labels for ${selector}`);
    }
    try {
      const possibleLabels = await languageProvider.fetchSeriesLabels(selector, true, this.state.seriesLimit);
      // If selector changed, clear loading state and discard result by returning early
      if (selector !== buildSelector(this.state.labels)) {
        if (lastFacetted) {
          this.updateLabelState(lastFacetted, { loading: false });
        }
        return;
      }
      if (Object.keys(possibleLabels).length === 0) {
        this.setState({ error: `Empty results, no matching label for ${selector}` });
        return;
      }
      const labels: SelectableLabel[] = facetLabels(this.state.labels, possibleLabels, lastFacetted);
      this.setState({ labels, error: '' });
      if (lastFacetted) {
        this.updateLabelState(lastFacetted, { loading: false });
      }
    } catch (error) {
      console.error(error);
    }
  }

  async validateSelector(selector: string) {
    const { languageProvider } = this.props;
    this.setState({ validationStatus: `Validating selector ${selector}`, error: '' });
    const streams = await languageProvider.fetchSeries(selector);
    this.setState({ validationStatus: `Selector is valid (${streams.length} series found)` });
  }

  render() {
    const { theme } = this.props;
    const { labels, labelSearchTerm, metricSearchTerm, status, error, validationStatus, valueSearchTerm } = this.state;
    const styles = getStyles(theme);
    if (labels.length === 0) {
      return (
        <div className={styles.wrapper}>
          <LoadingPlaceholder text="Loading labels..." />
        </div>
      );
    }

    // Filter metrics
    let metrics = labels.find((label) => label.name === METRIC_LABEL);
    if (metrics && metricSearchTerm) {
      metrics = {
        ...metrics,
        values: metrics.values?.filter((value) => value.selected || value.name.includes(metricSearchTerm)),
      };
    }

    // Filter labels
    let nonMetricLabels = labels.filter((label) => !label.hidden && label.name !== METRIC_LABEL);
    if (labelSearchTerm) {
      nonMetricLabels = nonMetricLabels.filter((label) => label.selected || label.name.includes(labelSearchTerm));
    }

    // Filter non-metric label values
    let selectedLabels = nonMetricLabels.filter((label) => label.selected && label.values);
    if (valueSearchTerm) {
      selectedLabels = selectedLabels.map((label) => ({
        ...label,
        values: label.values?.filter((value) => value.selected || value.name.includes(valueSearchTerm)),
      }));
    }
    const selector = buildSelector(this.state.labels);
    const empty = selector === EMPTY_SELECTOR;
    const metricCount = metrics?.values?.length || 0;

    return (
      <div className={styles.wrapper}>
        <Stack gap={3}>
          <div>
            <div className={styles.section}>
              <Label description="Once a metric is selected only possible labels are shown. Labels are limited by the series limit below.">
                1. Select a metric
              </Label>
              <div>
                <Input
                  onChange={this.onChangeMetricSearch}
                  aria-label="Filter expression for metric"
                  value={metricSearchTerm}
                  data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.selectMetric}
                />
              </div>
              <Label description="Set to 'none' to remove limit and show all labels for a selected metric. Removing the limit may cause performance issues.">
                Series limit
              </Label>
              <div>
                <Input
                  onChange={this.onChangeSeriesLimit}
                  aria-label="Limit results from series endpoint"
                  value={this.state.seriesLimit ?? DEFAULT_SERIES_LIMIT}
                  data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.seriesLimit}
                />
              </div>
              <div
                role="list"
                className={styles.valueListWrapper}
                data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.metricList}
              >
                <FixedSizeList
                  height={Math.min(450, metricCount * LIST_ITEM_SIZE)}
                  itemCount={metricCount}
                  itemSize={LIST_ITEM_SIZE}
                  itemKey={(i) => metrics!.values![i].name}
                  width={300}
                  className={styles.valueList}
                >
                  {({ index, style }) => {
                    const value = metrics?.values?.[index];
                    if (!value) {
                      return null;
                    }
                    return (
                      <div style={style}>
                        <PromLabel
                          name={metrics!.name}
                          value={value?.name}
                          title={value.details}
                          active={value?.selected}
                          onClick={this.onClickMetric}
                          searchTerm={metricSearchTerm}
                        />
                      </div>
                    );
                  }}
                </FixedSizeList>
              </div>
            </div>
          </div>

          <div>
            <div className={styles.section}>
              <Label description="Once label values are selected, only possible label combinations are shown.">
                2. Select labels to search in
              </Label>
              <div>
                <Input
                  onChange={this.onChangeLabelSearch}
                  aria-label="Filter expression for label"
                  value={labelSearchTerm}
                  data-testid={
                    selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelNamesFilter
                  }
                />
              </div>
              {/* Using fixed height here to prevent jumpy layout */}
              <div className={styles.list} style={{ height: 120 }}>
                {nonMetricLabels.map((label) => (
                  <PromLabel
                    key={label.name}
                    name={label.name}
                    loading={label.loading}
                    active={label.selected}
                    hidden={label.hidden}
                    facets={label.facets}
                    onClick={this.onClickLabel}
                    searchTerm={labelSearchTerm}
                  />
                ))}
              </div>
            </div>
            <div className={styles.section}>
              <Label description="Use the search field to find values across selected labels.">
                3. Select (multiple) values for your labels
              </Label>
              <div>
                <Input
                  onChange={this.onChangeValueSearch}
                  aria-label="Filter expression for label values"
                  value={valueSearchTerm}
                  data-testid={
                    selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.labelValuesFilter
                  }
                />
              </div>
              <div className={styles.valueListArea} ref={this.valueListsRef}>
                {selectedLabels.map((label) => (
                  <div
                    role="list"
                    key={label.name}
                    aria-label={`Values for ${label.name}`}
                    className={styles.valueListWrapper}
                  >
                    <div className={styles.valueTitle}>
                      <PromLabel
                        name={label.name}
                        loading={label.loading}
                        active={label.selected}
                        hidden={label.hidden}
                        //If no facets, we want to show number of all label values
                        facets={label.facets || label.values?.length}
                        onClick={this.onClickLabel}
                      />
                    </div>
                    <FixedSizeList
                      height={Math.min(200, LIST_ITEM_SIZE * (label.values?.length || 0))}
                      itemCount={label.values?.length || 0}
                      itemSize={28}
                      itemKey={(i) => label.values![i].name}
                      width={200}
                      className={styles.valueList}
                    >
                      {({ index, style }) => {
                        const value = label.values?.[index];
                        if (!value) {
                          return null;
                        }
                        return (
                          <div style={style}>
                            <PromLabel
                              name={label.name}
                              value={value?.name}
                              active={value?.selected}
                              onClick={this.onClickValue}
                              searchTerm={valueSearchTerm}
                            />
                          </div>
                        );
                      }}
                    </FixedSizeList>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Stack>

        <div className={styles.section}>
          <Label>4. Resulting selector</Label>
          <div aria-label="selector" className={styles.selector}>
            {selector}
          </div>
          {validationStatus && <div className={styles.validationStatus}>{validationStatus}</div>}
          <Stack>
            <Button
              data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useQuery}
              aria-label="Use selector for query button"
              disabled={empty}
              onClick={this.onClickRunQuery}
            >
              Use query
            </Button>
            <Button
              data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.useAsRateQuery}
              aria-label="Use selector as metrics button"
              variant="secondary"
              disabled={empty}
              onClick={this.onClickRunRateQuery}
            >
              Use as rate query
            </Button>
            <Button
              data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.validateSelector}
              aria-label="Validate submit button"
              variant="secondary"
              disabled={empty}
              onClick={this.onClickValidate}
            >
              Validate selector
            </Button>
            <Button
              data-testid={selectors.components.DataSource.Prometheus.queryEditor.code.metricsBrowser.clear}
              aria-label="Selector clear button"
              variant="secondary"
              onClick={this.onClickClear}
            >
              Clear
            </Button>
            <div className={cx(styles.status, (status || error) && styles.statusShowing)}>
              <span className={error ? styles.error : ''}>{error || status}</span>
            </div>
          </Stack>
        </div>
      </div>
    );
  }
}

export const PrometheusMetricsBrowser = withTheme2(UnthemedPrometheusMetricsBrowser);
