// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.tsx
import { ChangeEvent, Component, MouseEvent } from 'react';

import { getDefaultTimeRange } from '@grafana/data';
import { LoadingPlaceholder, Stack, withTheme2 } from '@grafana/ui';

import { LabelSelector } from './LabelSelector';
import { MetricSelector } from './MetricSelector';
import { SelectorActions } from './SelectorActions';
import { ValueSelector } from './ValueSelector';
import { buildSelector, facetLabels } from './selectorBuilder';
import { getStyles } from './styles';
import {
  BrowserProps,
  BrowserState,
  DEFAULT_SERIES_LIMIT,
  EMPTY_SELECTOR,
  FacettableValue,
  LAST_USED_LABELS_KEY,
  METRIC_LABEL,
  SelectableLabel,
} from './types';

export class UnthemedPrometheusMetricsBrowser extends Component<BrowserProps, BrowserState> {
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
    localStorage.removeItem(LAST_USED_LABELS_KEY);
    // Get metrics
    this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
  };

  onClickLabel = (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => {
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

  onClickValue = (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => {
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

  onClickMetric = (name: string, value: string | undefined, event: MouseEvent<HTMLElement>) => {
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
    const { languageProvider } = this.props;
    if (languageProvider) {
      const selectedLabels: string[] = JSON.parse(localStorage.getItem(LAST_USED_LABELS_KEY) ?? `[]`) ?? [];
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
    localStorage.setItem(LAST_USED_LABELS_KEY, JSON.stringify(selectedLabels));
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
      let rawValues = await languageProvider.getLabelValues(this.props.timeRange ?? getDefaultTimeRange(), name);
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
      const possibleLabels = await languageProvider.fetchSeriesLabels(
        this.props.timeRange ?? getDefaultTimeRange(),
        selector,
        true,
        this.state.seriesLimit
      );
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
    const streams = await languageProvider.fetchSeries(this.props.timeRange ?? getDefaultTimeRange(), selector);
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

    return (
      <div className={styles.wrapper}>
        <Stack gap={3}>
          <MetricSelector
            metrics={metrics}
            metricSearchTerm={metricSearchTerm}
            seriesLimit={this.state.seriesLimit ?? DEFAULT_SERIES_LIMIT}
            onChangeMetricSearch={this.onChangeMetricSearch}
            onChangeSeriesLimit={this.onChangeSeriesLimit}
            onClickMetric={this.onClickMetric}
            styles={styles}
          />
          <div>
            <LabelSelector
              nonMetricLabels={nonMetricLabels}
              labelSearchTerm={labelSearchTerm}
              onChangeLabelSearch={this.onChangeLabelSearch}
              onClickLabel={this.onClickLabel}
              styles={styles}
            />

            <ValueSelector
              selectedLabels={selectedLabels}
              valueSearchTerm={valueSearchTerm}
              onChangeValueSearch={this.onChangeValueSearch}
              onClickValue={this.onClickValue}
              onClickLabel={this.onClickLabel}
              styles={styles}
            />
          </div>
        </Stack>

        <SelectorActions
          selector={selector}
          validationStatus={validationStatus}
          status={status}
          error={error}
          empty={empty}
          onClickRunQuery={this.onClickRunQuery}
          onClickRunRateQuery={this.onClickRunRateQuery}
          onClickValidate={this.onClickValidate}
          onClickClear={this.onClickClear}
          styles={styles}
        />
      </div>
    );
  }
}

export const PrometheusMetricsBrowser = withTheme2(UnthemedPrometheusMetricsBrowser);
