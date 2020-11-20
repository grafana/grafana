import React, { ChangeEvent, PureComponent } from 'react';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv } from '@grafana/runtime';
import { LoadingState, SelectableValue } from '@grafana/data';

import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { QueryVariableModel, VariableRefresh, VariableSort, VariableWithMultiSupport } from '../types';
import { QueryVariableEditorState } from './reducer';
import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';
import { VariableEditorState } from '../editor/reducer';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { StoreState } from '../../../types';
import { connectWithStore } from '../../../core/utils/connectWithReduxStore';
import { toVariableIdentifier } from '../state/types';
import { changeVariableMultiValue } from '../state/actions';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { isLegacyQueryEditor, isQueryEditor } from '../guard';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableTextField } from '../editor/VariableTextField';
import { VariableSwitchField } from '../editor/VariableSwitchField';

export interface OwnProps extends VariableEditorProps<QueryVariableModel> {}

interface ConnectedProps {
  editor: VariableEditorState<QueryVariableEditorState>;
}

interface DispatchProps {
  initQueryVariableEditor: typeof initQueryVariableEditor;
  changeQueryVariableDataSource: typeof changeQueryVariableDataSource;
  changeQueryVariableQuery: typeof changeQueryVariableQuery;
  changeVariableMultiValue: typeof changeVariableMultiValue;
}

export type Props = OwnProps & ConnectedProps & DispatchProps;

export interface State {
  regex: string | null;
  tagsQuery: string | null;
  tagValuesQuery: string | null;
}

export class QueryVariableEditorUnConnected extends PureComponent<Props, State> {
  state: State = {
    regex: null,
    tagsQuery: null,
    tagValuesQuery: null,
  };

  async componentDidMount() {
    await this.props.initQueryVariableEditor(toVariableIdentifier(this.props.variable));
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.variable.datasource !== this.props.variable.datasource) {
      this.props.changeQueryVariableDataSource(
        toVariableIdentifier(this.props.variable),
        this.props.variable.datasource
      );
    }
  }

  onDataSourceChange = (option: SelectableValue<string>) => {
    this.props.onPropChange({ propName: 'query', propValue: '' });
    this.props.onPropChange({ propName: 'datasource', propValue: option.value });
  };

  onLegacyQueryChange = async (query: any, definition: string) => {
    if (this.props.variable.query !== query) {
      this.props.changeQueryVariableQuery(toVariableIdentifier(this.props.variable), query, definition);
    }
  };

  onQueryChange = async (query: any) => {
    if (this.props.variable.query !== query) {
      let definition = '';

      if (query && query.hasOwnProperty('query') && typeof query.query === 'string') {
        definition = query.query;
      }

      this.props.changeQueryVariableQuery(toVariableIdentifier(this.props.variable), query, definition);
    }
  };

  onRegExChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ regex: event.target.value });
  };

  onRegExBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    const regex = event.target.value;
    if (this.props.variable.regex !== regex) {
      this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
    }
  };

  onTagsQueryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ tagsQuery: event.target.value });
  };

  onTagsQueryBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    const tagsQuery = event.target.value;
    if (this.props.variable.tagsQuery !== tagsQuery) {
      this.props.onPropChange({ propName: 'tagsQuery', propValue: tagsQuery, updateOptions: true });
    }
  };

  onTagValuesQueryChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ tagValuesQuery: event.target.value });
  };

  onTagValuesQueryBlur = async (event: ChangeEvent<HTMLInputElement>) => {
    const tagValuesQuery = event.target.value;
    if (this.props.variable.tagValuesQuery !== tagValuesQuery) {
      this.props.onPropChange({ propName: 'tagValuesQuery', propValue: tagValuesQuery, updateOptions: true });
    }
  };

  onRefreshChange = (option: SelectableValue<VariableRefresh>) => {
    this.props.onPropChange({ propName: 'refresh', propValue: option.value });
  };

  onSortChange = async (option: SelectableValue<VariableSort>) => {
    this.props.onPropChange({ propName: 'sort', propValue: option.value, updateOptions: true });
  };

  onSelectionOptionsChange = async ({ propValue, propName }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  onUseTagsChange = async (event: ChangeEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'useTags', propValue: event.target.checked, updateOptions: true });
  };

  renderQueryEditor = () => {
    const { editor, variable } = this.props;
    if (!editor.extended || !editor.extended.dataSource || !editor.extended.VariableQueryEditor) {
      return null;
    }

    const query = variable.query;
    const datasource = editor.extended.dataSource;
    const VariableQueryEditor = editor.extended.VariableQueryEditor;

    if (isLegacyQueryEditor(VariableQueryEditor, datasource)) {
      return (
        <VariableQueryEditor
          datasource={datasource}
          query={query}
          templateSrv={getTemplateSrv()}
          onChange={this.onLegacyQueryChange}
        />
      );
    }

    const range = getTimeSrv().timeRange();

    if (isQueryEditor(VariableQueryEditor, datasource)) {
      return (
        <VariableQueryEditor
          datasource={datasource}
          query={query}
          onChange={this.onQueryChange}
          onRunQuery={() => {}}
          data={{ series: [], state: LoadingState.Done, timeRange: range }}
          range={range}
          onBlur={() => {}}
          history={[]}
        />
      );
    }

    return null;
  };

  render() {
    const dsOptions = this.props.editor.extended?.dataSources.length
      ? this.props.editor.extended?.dataSources.map(ds => ({ label: ds.name, value: ds.value ?? '' }))
      : [];
    const dsValue = dsOptions.find(o => o.value === this.props.variable.datasource) ?? dsOptions[0];
    const refreshOptions = [
      { label: 'Never', value: VariableRefresh.never },
      { label: 'On Dashboard Load', value: VariableRefresh.onDashboardLoad },
      { label: 'On Time Range Change', value: VariableRefresh.onTimeRangeChanged },
    ];
    const refreshValue = refreshOptions.find(o => o.value === this.props.variable.refresh) ?? refreshOptions[0];
    const sortOptions = [
      { label: 'Disabled', value: VariableSort.disabled },
      { label: 'Alphabetical (asc)', value: VariableSort.alphabeticalAsc },
      { label: 'Alphabetical (desc)', value: VariableSort.alphabeticalDesc },
      { label: 'Numerical (asc)', value: VariableSort.numericalAsc },
      { label: 'Numerical (desc)', value: VariableSort.numericalDesc },
      { label: 'Alphabetical (case-insensitive, asc)', value: VariableSort.alphabeticalCaseInsensitiveAsc },
      { label: 'Alphabetical (case-insensitive, desc)', value: VariableSort.alphabeticalCaseInsensitiveDesc },
    ];
    const sortValue = sortOptions.find(o => o.value === this.props.variable.sort) ?? sortOptions[0];

    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Query Options" />
        <VerticalGroup spacing="md">
          <VerticalGroup spacing="none">
            <VerticalGroup spacing="xs">
              <InlineFieldRow>
                <VariableSelectField
                  name="Data source"
                  value={dsValue}
                  options={dsOptions}
                  onChange={this.onDataSourceChange}
                  labelWidth={10}
                  aria-label={
                    selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsDataSourceSelect
                  }
                />
                <VariableSelectField
                  name="Refresh"
                  value={refreshValue}
                  options={refreshOptions}
                  onChange={this.onRefreshChange}
                  labelWidth={10}
                  aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelect}
                  tooltip="When to update the values of this variable."
                />
              </InlineFieldRow>
              <div style={{ flexDirection: 'column' }}>{this.renderQueryEditor()}</div>
            </VerticalGroup>
            <VariableTextField
              value={this.state.regex ?? this.props.variable.regex}
              name="Regex"
              placeholder="/.*-(?<text>.*)-(?<value>.*)-.*/"
              onChange={this.onRegExChange}
              onBlur={this.onRegExBlur}
              labelWidth={20}
              tooltip={
                <div>
                  Optional, if you want to extract part of a series name or metric node segment. Named capture groups
                  can be used to separate the display text and value (
                  <a
                    href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                    target="__blank"
                  >
                    see examples
                  </a>
                  ).
                </div>
              }
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput}
              grow
            />
            <VariableSelectField
              name="Sort"
              value={sortValue}
              options={sortOptions}
              onChange={this.onSortChange}
              labelWidth={10}
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsSortSelect}
              tooltip="How to sort the values of this variable."
            />
          </VerticalGroup>

          <SelectionOptionsEditor
            variable={this.props.variable}
            onPropChange={this.onSelectionOptionsChange}
            onMultiChanged={this.props.changeVariableMultiValue}
          />

          <VerticalGroup spacing="none">
            <h5>Value groups/tags (Experimental feature)</h5>
            <VariableSwitchField
              value={this.props.variable.useTags}
              name="Enabled"
              onChange={this.onUseTagsChange}
              aria-label={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsEnabledSwitch}
            />
            {this.props.variable.useTags ? (
              <VerticalGroup spacing="none">
                <VariableTextField
                  value={this.state.tagsQuery ?? this.props.variable.tagsQuery}
                  name="Tags query"
                  placeholder="metric name or tags query"
                  onChange={this.onTagsQueryChange}
                  onBlur={this.onTagsQueryBlur}
                  aria-label={
                    selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsTagsQueryInput
                  }
                  labelWidth={20}
                  grow
                />
                <VariableTextField
                  value={this.state.tagValuesQuery ?? this.props.variable.tagValuesQuery}
                  name="Tag values query"
                  placeholder="apps.$tag.*"
                  onChange={this.onTagValuesQueryChange}
                  onBlur={this.onTagValuesQueryBlur}
                  aria-label={
                    selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsTagsValuesQueryInput
                  }
                  labelWidth={20}
                  grow
                />
              </VerticalGroup>
            ) : null}
          </VerticalGroup>
        </VerticalGroup>
      </VerticalGroup>
    );
  }
}

const mapStateToProps: MapStateToProps<ConnectedProps, OwnProps, StoreState> = (state, ownProps) => ({
  editor: state.templating.editor as VariableEditorState<QueryVariableEditorState>,
});

const mapDispatchToProps: MapDispatchToProps<DispatchProps, OwnProps> = {
  initQueryVariableEditor,
  changeQueryVariableDataSource,
  changeQueryVariableQuery,
  changeVariableMultiValue,
};

export const QueryVariableEditor = connectWithStore(
  QueryVariableEditorUnConnected,
  mapStateToProps,
  mapDispatchToProps
);
