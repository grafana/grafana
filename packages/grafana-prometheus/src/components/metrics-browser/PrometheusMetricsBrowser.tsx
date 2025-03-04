// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/components/PrometheusMetricsBrowser.tsx
import { Component } from 'react';

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
    status: 'Ready',
    error: '',
    validationStatus: '',
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
        // FIXME Clear them in context
        // labelSearchTerm: '',
        // metricSearchTerm: '',
        // valueSearchTerm: '',
        status: '',
        error: '',
        validationStatus: '',
      };
    });
    localStorage.removeItem(LAST_USED_LABELS_KEY);
    // Get metrics
    this.fetchValues(METRIC_LABEL, EMPTY_SELECTOR);
  };

  onClickLabel = (name: string, value: string | undefined) => {
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
    this.updateLabelState(name, nextValue, '', () => this.doFacettingForLabel(name));
  };

  onClickValue = (name: string, value: string | undefined) => {
    const label = this.state.labels.find((l) => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Resetting search to prevent empty results
    // FIXME reset this in context
    // this.setState({ labelSearchTerm: '' });
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map((v) => ({ ...v, selected: v.name === value ? !v.selected : v.selected }));
    this.updateLabelState(name, { values }, '', () => this.doFacetting(name));
  };

  onClickMetric = (name: string, value: string | undefined) => {
    // Finding special metric label
    const label = this.state.labels.find((l) => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map((v) => ({
      ...v,
      selected: v.name === value || v.selected ? !v.selected : v.selected,
    }));
    // Toggle selected state of special metrics label
    const selected = values.some((v) => v.selected);
    this.updateLabelState(name, { selected, values }, '', () => this.doFacetting(name));
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
      // FIXME use series limit from useMetricsBrowser
      const possibleLabels = await languageProvider.fetchSeriesLabels(selector, true, DEFAULT_SERIES_LIMIT);
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

  render() {
    const { theme } = this.props;
    const { labels, status, error, validationStatus } = this.state;
    const styles = getStyles(theme);
    if (labels.length === 0) {
      return (
        <div className={styles.wrapper}>
          <LoadingPlaceholder text="Loading labels..." />
        </div>
      );
    }

    return (
      <div className={styles.wrapper}>
        <Stack gap={3}>
          <MetricSelector labels={labels} onClickMetric={this.onClickMetric} styles={styles} />
          <div>
            <LabelSelector labels={labels} onClickLabel={this.onClickLabel} styles={styles} />

            <ValueSelector
              labels={labels}
              onClickValue={this.onClickValue}
              onClickLabel={this.onClickLabel}
              styles={styles}
            />
          </div>
        </Stack>

        <SelectorActions
          labels={labels}
          validationStatusFromParent={validationStatus}
          status={status}
          errorFromParent={error}
          onClickRunQuery={this.onClickRunQuery}
          onClickRunRateQuery={this.onClickRunRateQuery}
          onClickClear={this.onClickClear}
          styles={styles}
        />
      </div>
    );
  }
}

export const PrometheusMetricsBrowser = withTheme2(UnthemedPrometheusMetricsBrowser);
