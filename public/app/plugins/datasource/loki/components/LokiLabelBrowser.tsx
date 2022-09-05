import { css, cx } from '@emotion/css';
import { sortBy } from 'lodash';
import React, { ChangeEvent } from 'react';
import { FixedSizeList } from 'react-window';

import { CoreApp, GrafanaTheme2 } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import {
  Button,
  HighlightPart,
  HorizontalGroup,
  Input,
  Label,
  LoadingPlaceholder,
  withTheme2,
  BrowserLabel as LokiLabel,
  fuzzyMatch,
} from '@grafana/ui';

import PromQlLanguageProvider from '../../prometheus/language_provider';
import LokiLanguageProvider from '../language_provider';
import { escapeLabelValueInExactSelector, escapeLabelValueInRegexSelector } from '../language_utils';

// Hard limit on labels to render
const MAX_LABEL_COUNT = 1000;
const MAX_VALUE_COUNT = 10000;
const MAX_AUTO_SELECT = 4;
const EMPTY_SELECTOR = '{}';

export interface BrowserProps {
  // TODO #33976: Is it possible to use a common interface here? For example: LabelsLanguageProvider
  languageProvider: LokiLanguageProvider | PromQlLanguageProvider;
  onChange: (selector: string) => void;
  theme: GrafanaTheme2;
  app?: CoreApp;
  autoSelect?: number;
  hide?: () => void;
  lastUsedLabels: string[];
  storeLastUsedLabels: (labels: string[]) => void;
  deleteLastUsedLabels: () => void;
}

interface BrowserState {
  labels: SelectableLabel[];
  searchTerm: string;
  status: string;
  error: string;
  validationStatus: string;
}

interface FacettableValue {
  name: string;
  selected?: boolean;
  highlightParts?: HighlightPart[];
  order?: number;
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
  const selectedLabels = [];
  for (const label of labels) {
    if (label.selected && label.values && label.values.length > 0) {
      const selectedValues = label.values.filter((value) => value.selected).map((value) => value.name);
      if (selectedValues.length > 1) {
        selectedLabels.push(`${label.name}=~"${selectedValues.map(escapeLabelValueInRegexSelector).join('|')}"`);
      } else if (selectedValues.length === 1) {
        selectedLabels.push(`${label.name}="${escapeLabelValueInExactSelector(selectedValues[0])}"`);
      }
    }
  }
  return ['{', selectedLabels.join(','), '}'].join('');
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
      return { ...label, loading: false, values: existingValues, facets: existingValues.length };
    }

    // Label is facetted out, hide all values
    return { ...label, loading: false, hidden: !possibleValues, values: undefined, facets: 0 };
  });
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    background-color: ${theme.colors.background.secondary};
    padding: ${theme.spacing(2)};
    width: 100%;
  `,
  list: css`
    margin-top: ${theme.spacing(1)};
    display: flex;
    flex-wrap: wrap;
    max-height: 200px;
    overflow: auto;
  `,
  section: css`
    & + & {
      margin: ${theme.spacing(2, 0)};
    }
    position: relative;
  `,
  selector: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    margin-bottom: ${theme.spacing(1)};
  `,
  status: css`
    padding: ${theme.spacing(0.5)};
    color: ${theme.colors.text.secondary};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    /* using absolute positioning because flex interferes with ellipsis */
    position: absolute;
    width: 50%;
    right: 0;
    text-align: right;
    transition: opacity 100ms linear;
    opacity: 0;
  `,
  statusShowing: css`
    opacity: 1;
  `,
  error: css`
    color: ${theme.colors.error.main};
  `,
  valueList: css`
    margin-right: ${theme.spacing(1)};
    resize: horizontal;
  `,
  valueListWrapper: css`
    border-left: 1px solid ${theme.colors.border.medium};
    margin: ${theme.spacing(1, 0)};
    padding: ${theme.spacing(1, 0, 1, 1)};
  `,
  valueListArea: css`
    display: flex;
    flex-wrap: wrap;
    margin-top: ${theme.spacing(1)};
  `,
  valueTitle: css`
    margin-left: -${theme.spacing(0.5)};
    margin-bottom: ${theme.spacing(1)};
  `,
  validationStatus: css`
    padding: ${theme.spacing(0.5)};
    margin-bottom: ${theme.spacing(1)};
    color: ${theme.colors.text.maxContrast};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,
});

export class UnthemedLokiLabelBrowser extends React.Component<BrowserProps, BrowserState> {
  state: BrowserState = {
    labels: [] as SelectableLabel[],
    searchTerm: '',
    status: 'Ready',
    error: '',
    validationStatus: '',
  };

  onChangeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ searchTerm: event.target.value });
  };

  onClickRunLogsQuery = () => {
    reportInteraction('grafana_loki_log_browser_closed', {
      app: this.props.app,
      closeType: 'showLogsButton',
    });
    const selector = buildSelector(this.state.labels);
    this.props.onChange(selector);
  };

  onClickRunMetricsQuery = () => {
    reportInteraction('grafana_loki_log_browser_closed', {
      app: this.props.app,
      closeType: 'showLogsRateButton',
    });
    const selector = buildSelector(this.state.labels);
    const query = `rate(${selector}[$__interval])`;
    this.props.onChange(query);
  };

  onClickClear = () => {
    reportInteraction('grafana_loki_log_browser_closed', {
      app: this.props.app,
      closeType: 'clearButton',
    });
    this.setState((state) => {
      const labels: SelectableLabel[] = state.labels.map((label) => ({
        ...label,
        values: undefined,
        selected: false,
        loading: false,
        hidden: false,
        facets: undefined,
      }));
      return { labels, searchTerm: '', status: '', error: '', validationStatus: '' };
    });
    this.props.deleteLastUsedLabels();
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
    this.setState({ searchTerm: '' });
    this.updateLabelState(name, nextValue, '', () => this.doFacettingForLabel(name));
  };

  onClickValue = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    const label = this.state.labels.find((l) => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Resetting search to prevent empty results
    this.setState({ searchTerm: '' });
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map((v) => ({ ...v, selected: v.name === value ? !v.selected : v.selected }));
    this.updateLabelState(name, { values }, '', () => this.doFacetting(name));
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
    const { languageProvider, autoSelect = MAX_AUTO_SELECT, lastUsedLabels } = this.props;
    if (languageProvider) {
      const selectedLabels: string[] = lastUsedLabels;
      languageProvider.start().then(() => {
        let rawLabels: string[] = languageProvider.getLabelKeys();
        if (rawLabels.length > MAX_LABEL_COUNT) {
          const error = `Too many labels found (showing only ${MAX_LABEL_COUNT} of ${rawLabels.length})`;
          rawLabels = rawLabels.slice(0, MAX_LABEL_COUNT);
          this.setState({ error });
        }
        // Auto-select all labels if label list is small enough
        const labels: SelectableLabel[] = rawLabels.map((label, i, arr) => ({
          name: label,
          selected: (arr.length <= autoSelect && selectedLabels.length === 0) || selectedLabels.includes(label),
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
        this.state.labels.forEach((label) => label.selected && this.fetchValues(label.name, selector));
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
        this.updateLabelState(name, { loading: false }, '');
        return;
      }
      if (rawValues.length > MAX_VALUE_COUNT) {
        const error = `Too many values for ${name} (showing only ${MAX_VALUE_COUNT} of ${rawValues.length})`;
        rawValues = rawValues.slice(0, MAX_VALUE_COUNT);
        this.setState({ error });
      }
      const values: FacettableValue[] = rawValues.map((value) => ({ name: value }));
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
      const possibleLabels = await languageProvider.fetchSeriesLabels(selector, true);
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
    this.setState({ validationStatus: `Selector is valid (${streams.length} streams found)` });
  }

  render() {
    const { theme } = this.props;
    const { labels, searchTerm, status, error, validationStatus } = this.state;
    if (labels.length === 0) {
      return <LoadingPlaceholder text="Loading labels..." />;
    }
    const styles = getStyles(theme);
    const selector = buildSelector(this.state.labels);
    const empty = selector === EMPTY_SELECTOR;

    let selectedLabels = labels.filter((label) => label.selected && label.values);
    if (searchTerm) {
      selectedLabels = selectedLabels.map((label) => {
        const searchResults = label.values!.filter((value) => {
          // Always return selected values
          if (value.selected) {
            value.highlightParts = undefined;
            return true;
          }
          const fuzzyMatchResult = fuzzyMatch(value.name.toLowerCase(), searchTerm.toLowerCase());
          if (fuzzyMatchResult.found) {
            value.highlightParts = fuzzyMatchResult.ranges;
            value.order = fuzzyMatchResult.distance;
            return true;
          } else {
            return false;
          }
        });
        return {
          ...label,
          values: sortBy(searchResults, (value) => (value.selected ? -Infinity : value.order)),
        };
      });
    } else {
      // Clear highlight parts when searchTerm is cleared
      selectedLabels = this.state.labels
        .filter((label) => label.selected && label.values)
        .map((label) => ({
          ...label,
          values: label?.values ? label.values.map((value) => ({ ...value, highlightParts: undefined })) : [],
        }));
    }

    return (
      <div className={styles.wrapper}>
        <div className={styles.section}>
          <Label description="Which labels would you like to consider for your search?">
            1. Select labels to search in
          </Label>
          <div className={styles.list}>
            {labels.map((label) => (
              <LokiLabel
                key={label.name}
                name={label.name}
                loading={label.loading}
                active={label.selected}
                hidden={label.hidden}
                facets={label.facets}
                onClick={this.onClickLabel}
              />
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <Label description="Choose the label values that you would like to use for the query. Use the search field to find values across selected labels.">
            2. Find values for the selected labels
          </Label>
          <div>
            <Input onChange={this.onChangeSearch} aria-label="Filter expression for values" value={searchTerm} />
          </div>
          <div className={styles.valueListArea}>
            {selectedLabels.map((label) => (
              <div role="list" key={label.name} className={styles.valueListWrapper}>
                <div className={styles.valueTitle} aria-label={`Values for ${label.name}`}>
                  <LokiLabel
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
                  height={200}
                  itemCount={label.values?.length || 0}
                  itemSize={28}
                  itemKey={(i) => (label.values as FacettableValue[])[i].name}
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
                        <LokiLabel
                          name={label.name}
                          value={value?.name}
                          active={value?.selected}
                          highlightParts={value?.highlightParts}
                          onClick={this.onClickValue}
                          searchTerm={searchTerm}
                        />
                      </div>
                    );
                  }}
                </FixedSizeList>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <Label>3. Resulting selector</Label>
          <div aria-label="selector" className={styles.selector}>
            {selector}
          </div>
          {validationStatus && <div className={styles.validationStatus}>{validationStatus}</div>}
          <HorizontalGroup>
            <Button aria-label="Use selector as logs button" disabled={empty} onClick={this.onClickRunLogsQuery}>
              Show logs
            </Button>
            <Button
              aria-label="Use selector as metrics button"
              variant="secondary"
              disabled={empty}
              onClick={this.onClickRunMetricsQuery}
            >
              Show logs rate
            </Button>
            <Button
              aria-label="Validate submit button"
              variant="secondary"
              disabled={empty}
              onClick={this.onClickValidate}
            >
              Validate selector
            </Button>
            <Button aria-label="Selector clear button" variant="secondary" onClick={this.onClickClear}>
              Clear
            </Button>
            <div className={cx(styles.status, (status || error) && styles.statusShowing)}>
              <span className={error ? styles.error : ''}>{error || status}</span>
            </div>
          </HorizontalGroup>
        </div>
      </div>
    );
  }
}

export const LokiLabelBrowser = withTheme2(UnthemedLokiLabelBrowser);
