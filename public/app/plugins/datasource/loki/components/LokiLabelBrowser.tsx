import React, { Component, createRef, ChangeEvent } from 'react';
import {
  Button,
  HorizontalGroup,
  Input,
  Label,
  LoadingPlaceholder,
  Popover,
  PopoverController,
  stylesFactory,
  withTheme,
} from '@grafana/ui';
import LokiLanguageProvider from '../language_provider';
import { css } from 'emotion';
import store from 'app/core/store';
import { FixedSizeList } from 'react-window';

import { GrafanaTheme } from '@grafana/data';
import { LokiLabel } from './LokiLabel';

// Hard limit on labels to render
const MAX_LABEL_COUNT = 100;
const MAX_VALUE_COUNT = 10000;
const EMPTY_SELECTOR = '{}';
export const LAST_USED_LABELS_KEY = 'grafana.datasources.loki.browser.labels';

type onChange = (selector: string) => void;

interface Props {
  buttonClass: string;
  buttonText: string;
  disabled: boolean;
  languageProvider: LokiLanguageProvider;
  theme: GrafanaTheme;
  onChange: onChange;
}

export interface BrowserProps {
  languageProvider: LokiLanguageProvider;
  onChange: onChange;
  theme: GrafanaTheme;
  hide?: () => void;
}

interface BrowserState {
  labels: SelectableLabel[];
  searchTerm: string;
}

interface FacettableValue {
  name: string;
  // facetted?: boolean; // True if value is possible given the selector
  selected?: boolean;
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
      const selectedValues = label.values.filter(value => value.selected).map(value => value.name);
      if (selectedValues.length > 1) {
        selectedLabels.push(`${label.name}=~"${selectedValues.join('|')}"`);
      } else if (selectedValues.length === 1) {
        selectedLabels.push(`${label.name}="${selectedValues[0]}"`);
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
  return labels.map(label => {
    const possibleValues = possibleLabels[label.name];
    if (possibleValues) {
      let existingValues: FacettableValue[];
      if (label.name === lastFacetted && label.values) {
        // Facetting this label, show all values
        existingValues = label.values;
      } else {
        // Keep selection in other facets
        const selectedValues: Set<string> = new Set(
          label.values?.filter(value => value.selected).map(value => value.name) || []
        );
        // Values for this label have not been requested yet, let's use the facetted ones as the initial values
        existingValues = possibleValues.map(value => ({ name: value, selected: selectedValues.has(value) }));
      }
      return { ...label, loading: false, values: existingValues, facets: existingValues.length };
    }

    // Label is facetted out, hide all values
    return { ...label, loading: false, hidden: !possibleValues, values: undefined, facets: 0 };
  });
}

const getStyles = stylesFactory((theme: GrafanaTheme) => ({
  wrapper: css`
    z-index: 1040;
    max-width: 70rem;
  `,
  popover: css`
    color: ${theme.colors.text};
    background: ${theme.colors.bg2};
    z-index: 1;
    box-shadow: 0 2px 5px 0 ${theme.colors.dropdownShadow};
    min-width: 200px;
    display: inline-block;
    border-radius: ${theme.border.radius.sm};
    padding: ${theme.spacing.sm};
  `,
  list: css`
    margin-top: ${theme.spacing.sm};
    display: flex;
    flex-wrap: wrap;
    max-height: 200px;
    overflow: auto;
  `,
  section: css`
    & + & {
      margin: ${theme.spacing.md} 0;
    }
  `,
  selector: css`
    font-family: ${theme.typography.fontFamily.monospace};
    margin-bottom: ${theme.spacing.sm};
  `,
  valueCell: css`
    overflow: hidden;
    text-overflow: ellipsis;
  `,
  valueList: css`
    margin-right: ${theme.spacing.sm};
  `,
  valueListWrapper: css`
    padding: ${theme.spacing.xs};
    border-left: 1px solid ${theme.colors.border1};
  `,
  valueListArea: css`
    display: flex;
    flex-direction: row;
    margin-top: ${theme.spacing.sm};
  `,
  valueTitle: css`
    margin-left: -${theme.spacing.xs};
    margin-bottom: ${theme.spacing.sm};
  `,
}));

export class LokiLabelBrowserPopover extends React.Component<BrowserProps, BrowserState> {
  state = {
    labels: [] as SelectableLabel[],
    searchTerm: '',
  };

  onChangeSearch = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ searchTerm: event.target.value });
  };

  onClickAccept = () => {
    const selector = buildSelector(this.state.labels);
    this.props.onChange(selector);
  };

  onClickClear = () => {
    this.setState(state => {
      const labels: SelectableLabel[] = state.labels.map(label => ({
        ...label,
        values: undefined,
        selected: false,
        loading: false,
        hidden: false,
        facets: undefined,
      }));
      return { labels, searchTerm: '' };
    });
    store.delete(LAST_USED_LABELS_KEY);
  };

  onClickLabel = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    const label = this.state.labels.find(l => l.name === name);
    if (!label) {
      return;
    }
    // Toggle selected state
    const selected = !label.selected;
    let nextValue: Partial<SelectableLabel> = { selected };
    if (label.values && !selected) {
      // Deselect all values if label was deselected
      const values = label.values.map(value => ({ ...value, selected: false }));
      nextValue = { ...nextValue, facets: 0, values };
    }
    this.updateLabelState(name, nextValue, () => {
      const selectedLabels = this.state.labels.filter(label => label.selected).map(label => label.name);
      store.setObject(LAST_USED_LABELS_KEY, selectedLabels);
      if (selected) {
        // Refetch values for newly selected label...
        if (!label.values) {
          this.fetchValues(name);
        }
      } else {
        // Only need to facet when deselecting labels
        this.doFacetting();
      }
    });
  };

  onClickValue = (name: string, value: string | undefined, event: React.MouseEvent<HTMLElement>) => {
    const label = this.state.labels.find(l => l.name === name);
    if (!label || !label.values) {
      return;
    }
    // Toggling value for selected label, leaving other values intact
    const values = label.values.map(v => ({ ...v, selected: v.name === value ? !v.selected : v.selected }));
    this.updateLabelState(name, { values }, () => this.doFacetting(name));
  };

  updateLabelState(name: string, updatedFields: Partial<SelectableLabel>, cb?: () => void) {
    this.setState(state => {
      const labels: SelectableLabel[] = state.labels.map(label => {
        if (label.name === name) {
          return { ...label, ...updatedFields };
        }
        return label;
      });
      return { labels };
    }, cb);
  }

  componentDidMount() {
    const { languageProvider } = this.props;
    if (languageProvider) {
      const selectedLabels: string[] = store.getObject(LAST_USED_LABELS_KEY, []);
      languageProvider.start().then(() => {
        const labels: SelectableLabel[] = languageProvider
          .getLabelKeys()
          .slice(0, MAX_LABEL_COUNT)
          .map(label => ({ name: label, selected: selectedLabels.includes(label), loading: false }));
        this.setState({ labels }, () => {
          this.state.labels.forEach(label => {
            if (label.selected) {
              this.fetchValues(label.name);
            }
          });
        });
      });
    }
  }

  doFacetting = (lastFacetted?: string) => {
    const selector = buildSelector(this.state.labels);
    if (selector === EMPTY_SELECTOR) {
      // Clear up facetting
      const labels: SelectableLabel[] = this.state.labels.map(label => {
        return { ...label, facets: 0, values: undefined, hidden: false };
      });
      this.setState({ labels }, () => {
        // Get fresh set of values
        this.state.labels.forEach(label => label.selected && this.fetchValues(label.name));
      });
    } else {
      // Do facetting
      this.fetchSeries(selector, lastFacetted);
    }
  };

  async fetchValues(name: string) {
    const { languageProvider } = this.props;
    this.updateLabelState(name, { loading: true });
    try {
      const values: FacettableValue[] = (await languageProvider.getLabelValues(name))
        .slice(0, MAX_VALUE_COUNT)
        .map(value => ({ name: value }));
      this.updateLabelState(name, { values, loading: false });
    } catch (error) {
      console.error(error);
    }
  }

  async fetchSeries(name: string, lastFacetted?: string) {
    const { languageProvider } = this.props;
    // this.updateLabelState(name, { loading: true });
    try {
      const possibleLabels = await languageProvider.fetchSeriesLabels(name);
      if (Object.keys(possibleLabels).length === 0) {
        // Sometimes the backend does not return a valid set
        console.error('No results for label combination, but should not occur.');
        // TODO mark label as broken instead of returning here
        return;
      }
      const labels: SelectableLabel[] = facetLabels(this.state.labels, possibleLabels, lastFacetted);
      this.setState({ labels });
    } catch (error) {
      console.error(error);
    }
  }

  render() {
    const { theme } = this.props;
    const { labels, searchTerm } = this.state;
    if (labels.length === 0) {
      return <LoadingPlaceholder text="Loading labels..." />;
    }
    const styles = getStyles(theme);
    let matcher: RegExp;
    let selectedLabels = labels.filter(label => label.selected && label.values);
    if (searchTerm) {
      // TODO extract from render() and debounce
      try {
        matcher = new RegExp(searchTerm.split('').join('.*'), 'i');
        selectedLabels = selectedLabels.map(label => ({
          ...label,
          values: label.values?.filter(value => value.selected || matcher.test(value.name)),
        }));
      } catch (error) {}
    }
    const selector = buildSelector(this.state.labels);
    const empty = selector === EMPTY_SELECTOR;
    return (
      <>
        <div className={styles.section}>
          <Label description="Which labels would you like to consider for your search?">
            1. Select labels to search in
          </Label>
          <div className={styles.list}>
            {labels.map(label => (
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
          <Label description="Choose the label values that you would like to use for the query.">
            2. Find values for the selected labels
          </Label>
          <div>
            <Input onChange={this.onChangeSearch} aria-label="Filter expression for values" value={searchTerm} />
          </div>
          <div className={styles.valueListArea}>
            {selectedLabels.map(label => (
              <div role="list" key={label.name} className={styles.valueListWrapper}>
                <div className={styles.valueTitle} aria-label={`Values for ${label.name}`}>
                  <LokiLabel
                    name={label.name}
                    loading={label.loading}
                    active={label.selected}
                    hidden={label.hidden}
                    facets={label.facets}
                    onClick={this.onClickLabel}
                  />
                </div>
                <FixedSizeList
                  height={200}
                  itemCount={label.values?.length || 0}
                  itemSize={25}
                  itemKey={i => (label.values as FacettableValue[])[i].name}
                  width={200}
                  className={styles.valueList}
                >
                  {({ index, style }) => {
                    const value = label.values?.[index];
                    if (!value) {
                      return null;
                    }
                    return (
                      <div style={style} className={styles.valueCell}>
                        <LokiLabel
                          name={label.name}
                          value={value?.name}
                          active={value?.selected}
                          onClick={this.onClickValue}
                          searchTerm={matcher}
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
          <HorizontalGroup>
            <Button aria-label="Selector submit button" disabled={empty} onClick={this.onClickAccept}>
              Use selector
            </Button>
            <Button aria-label="Selector clear button" variant="secondary" onClick={this.onClickClear}>
              Clear labels
            </Button>
          </HorizontalGroup>
        </div>
      </>
    );
  }
}

class UnthemedLokiLabelBrowser extends Component<Props> {
  static displayName = 'LokiLabelBrowser';
  pickerTriggerRef = createRef<any>();
  hider = {
    showPopper: () => {},
    hidePopper: () => {},
  };
  showing = false;

  onChange = (selector: string) => {
    this.props.onChange(selector);
    this.toggle();
  };

  toggle = () => {
    if (this.showing) {
      this.hider.hidePopper();
      this.showing = false;
    } else {
      this.hider.showPopper();
      this.showing = true;
    }
  };

  render() {
    const { buttonClass, buttonText, disabled, languageProvider, theme } = this.props;
    const popoverElement = React.createElement(LokiLabelBrowserPopover, {
      languageProvider,
      theme,
      onChange: this.onChange,
    });
    const styles = getStyles(theme);

    return (
      <PopoverController content={popoverElement} hideAfter={300}>
        {(showPopper, hidePopper, popperProps) => {
          // HACK
          this.hider = { hidePopper, showPopper };
          return (
            <>
              {this.pickerTriggerRef.current && (
                <Popover
                  {...popperProps}
                  placement="bottom-end"
                  referenceElement={this.pickerTriggerRef.current}
                  wrapperClassName={styles.wrapper}
                  className={styles.popover}
                />
              )}
              <button disabled={disabled} ref={this.pickerTriggerRef} className={buttonClass} onClick={this.toggle}>
                {buttonText}
              </button>
            </>
          );
        }}
      </PopoverController>
    );
  }
}

export const LokiLabelBrowser = withTheme(UnthemedLokiLabelBrowser);
