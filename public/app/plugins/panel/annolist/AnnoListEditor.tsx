// Libraries
import React, { PureComponent, ChangeEvent } from 'react';

// Components
import { PanelOptionsGroup, PanelOptionsGrid, Switch, FormField, FormLabel } from '@grafana/ui';

import { PanelEditorProps, toIntegerOrUndefined, toNumberString } from '@grafana/data';

// Types
import { AnnoOptions } from './types';
import { TagBadge } from 'app/core/components/TagFilter/TagBadge';

interface State {
  tag: string;
}

export class AnnoListEditor extends PureComponent<PanelEditorProps<AnnoOptions>, State> {
  constructor(props: PanelEditorProps<AnnoOptions>) {
    super(props);

    this.state = {
      tag: '',
    };
  }

  // Display
  //-----------

  onToggleShowUser = () =>
    this.props.onOptionsChange({ ...this.props.options, showUser: !this.props.options.showUser });

  onToggleShowTime = () =>
    this.props.onOptionsChange({ ...this.props.options, showTime: !this.props.options.showTime });

  onToggleShowTags = () =>
    this.props.onOptionsChange({ ...this.props.options, showTags: !this.props.options.showTags });

  // Navigate
  //-----------

  onNavigateBeforeChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onOptionsChange({ ...this.props.options, navigateBefore: event.target.value });
  };

  onNavigateAfterChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onOptionsChange({ ...this.props.options, navigateAfter: event.target.value });
  };

  onToggleNavigateToPanel = () =>
    this.props.onOptionsChange({ ...this.props.options, navigateToPanel: !this.props.options.navigateToPanel });

  // Search
  //-----------
  onLimitChange = (event: ChangeEvent<HTMLInputElement>) => {
    const v = toIntegerOrUndefined(event.target.value);
    this.props.onOptionsChange({ ...this.props.options, limit: v });
  };

  onToggleOnlyFromThisDashboard = () =>
    this.props.onOptionsChange({
      ...this.props.options,
      onlyFromThisDashboard: !this.props.options.onlyFromThisDashboard,
    });

  onToggleOnlyInTimeRange = () =>
    this.props.onOptionsChange({ ...this.props.options, onlyInTimeRange: !this.props.options.onlyInTimeRange });

  // Tags
  //-----------

  onTagTextChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ tag: event.target.value });
  };

  onTagClick = (e: React.SyntheticEvent, tag: string) => {
    e.stopPropagation();

    const tags = this.props.options.tags.filter(item => item !== tag);
    this.props.onOptionsChange({
      ...this.props.options,
      tags,
    });
  };

  renderTags = (tags: string[]): JSX.Element => {
    if (!tags || !tags.length) {
      return null;
    }
    return (
      <>
        {tags.map(tag => {
          return (
            <span key={tag} onClick={e => this.onTagClick(e, tag)} className="pointer">
              <TagBadge label={tag} removeIcon={true} count={0} />
            </span>
          );
        })}
      </>
    );
  };

  render() {
    const { options } = this.props;
    const labelWidth = 8;

    return (
      <PanelOptionsGrid>
        <PanelOptionsGroup title="Display">
          <Switch
            label="Show User"
            labelClass={`width-${labelWidth}`}
            checked={options.showUser}
            onChange={this.onToggleShowUser}
          />
          <Switch
            label="Show Time"
            labelClass={`width-${labelWidth}`}
            checked={options.showTime}
            onChange={this.onToggleShowTime}
          />
          <Switch
            label="Show Tags"
            labelClass={`width-${labelWidth}`}
            checked={options.showTags}
            onChange={this.onToggleShowTags}
          />
        </PanelOptionsGroup>
        <PanelOptionsGroup title="Navigate">
          <FormField
            label="Before"
            labelWidth={labelWidth}
            onChange={this.onNavigateBeforeChange}
            value={options.navigateBefore}
          />
          <FormField
            label="After"
            labelWidth={labelWidth}
            onChange={this.onNavigateAfterChange}
            value={options.navigateAfter}
          />
          <Switch
            label="To Panel"
            labelClass={`width-${labelWidth}`}
            checked={options.navigateToPanel}
            onChange={this.onToggleNavigateToPanel}
          />
        </PanelOptionsGroup>
        <PanelOptionsGroup title="Search">
          <Switch
            label="Only This Dashboard"
            labelClass={`width-12`}
            checked={options.onlyFromThisDashboard}
            onChange={this.onToggleOnlyFromThisDashboard}
          />
          <Switch
            label="Within Time Range"
            labelClass={`width-12`}
            checked={options.onlyInTimeRange}
            onChange={this.onToggleOnlyInTimeRange}
          />
          <div className="form-field">
            <FormLabel width={6}>Tags</FormLabel>
            {this.renderTags(options.tags)}
            <input
              type="text"
              className={`gf-form-input width-${8}`}
              value={this.state.tag}
              onChange={this.onTagTextChange}
              onKeyPress={ev => {
                if (this.state.tag && ev.key === 'Enter') {
                  const tags = [...options.tags, this.state.tag];
                  this.props.onOptionsChange({
                    ...this.props.options,
                    tags,
                  });
                  this.setState({ tag: '' });
                  ev.preventDefault();
                }
              }}
            />
          </div>

          <FormField
            label="Limit"
            labelWidth={6}
            onChange={this.onLimitChange}
            value={toNumberString(options.limit)}
            type="number"
          />
        </PanelOptionsGroup>
      </PanelOptionsGrid>
    );
  }
}
