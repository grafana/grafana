import React, { ChangeEvent, FormEvent, PureComponent } from 'react';
import { css } from 'emotion';
import { MapDispatchToProps, MapStateToProps } from 'react-redux';
import { InlineField, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { getTemplateSrv } from '@grafana/runtime';
import { DataSourceInstanceSettings, LoadingState, SelectableValue } from '@grafana/data';

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
import { VariableTextField } from '../editor/VariableTextField';
import { VariableSwitchField } from '../editor/VariableSwitchField';
import { QueryVariableRefreshSelect } from './QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from './QueryVariableSortSelect';
import { DataSourcePicker } from 'app/core/components/Select/DataSourcePicker';

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

  onDataSourceChange = (dsSettings: DataSourceInstanceSettings) => {
    this.props.onPropChange({ propName: 'query', propValue: '' });
    this.props.onPropChange({
      propName: 'datasource',
      propValue: dsSettings.isDefault ? null : dsSettings.name,
    });
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

  onRegExChange = (event: FormEvent<HTMLInputElement>) => {
    this.setState({ regex: event.currentTarget.value });
  };

  onRegExBlur = async (event: FormEvent<HTMLInputElement>) => {
    const regex = event.currentTarget.value;
    if (this.props.variable.regex !== regex) {
      this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
    }
  };

  onTagsQueryChange = async (event: FormEvent<HTMLInputElement>) => {
    this.setState({ tagsQuery: event.currentTarget.value });
  };

  onTagsQueryBlur = async (event: FormEvent<HTMLInputElement>) => {
    const tagsQuery = event.currentTarget.value;
    if (this.props.variable.tagsQuery !== tagsQuery) {
      this.props.onPropChange({ propName: 'tagsQuery', propValue: tagsQuery, updateOptions: true });
    }
  };

  onTagValuesQueryChange = async (event: FormEvent<HTMLInputElement>) => {
    this.setState({ tagValuesQuery: event.currentTarget.value });
  };

  onTagValuesQueryBlur = async (event: FormEvent<HTMLInputElement>) => {
    const tagValuesQuery = event.currentTarget.value;
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
    return (
      <VerticalGroup spacing="xs">
        <VariableSectionHeader name="Query Options" />
        <VerticalGroup spacing="lg">
          <VerticalGroup spacing="none">
            <InlineFieldRow>
              <InlineField label="Data source" labelWidth={20}>
                <DataSourcePicker
                  current={this.props.variable.datasource}
                  onChange={this.onDataSourceChange}
                  variables={true}
                />
              </InlineField>
              <QueryVariableRefreshSelect onChange={this.onRefreshChange} refresh={this.props.variable.refresh} />
            </InlineFieldRow>
            <div
              className={css`
                flex-direction: column;
                width: 100%;
              `}
            >
              {this.renderQueryEditor()}
            </div>
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
              ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInput}
              grow
            />
            <QueryVariableSortSelect onChange={this.onSortChange} sort={this.props.variable.sort} />
          </VerticalGroup>

          <SelectionOptionsEditor
            variable={this.props.variable}
            onPropChange={this.onSelectionOptionsChange}
            onMultiChanged={this.props.changeVariableMultiValue}
          />

          <VerticalGroup spacing="none">
            <h5>Value group tags</h5>
            <em className="muted p-b-1">Experimental feature, will be deprecated in Grafana v8.</em>

            <VariableSwitchField
              value={this.props.variable.useTags}
              name="Enabled"
              onChange={this.onUseTagsChange}
              ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.valueGroupsTagsEnabledSwitch}
            />
            {this.props.variable.useTags ? (
              <VerticalGroup spacing="none">
                <VariableTextField
                  value={this.state.tagsQuery ?? this.props.variable.tagsQuery}
                  name="Tags query"
                  placeholder="metric name or tags query"
                  onChange={this.onTagsQueryChange}
                  onBlur={this.onTagsQueryBlur}
                  ariaLabel={
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
                  ariaLabel={
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
