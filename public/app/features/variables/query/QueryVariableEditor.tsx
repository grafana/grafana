import React, { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import { DataSourceInstanceSettings, getDataSourceRef, LoadingState, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker, getTemplateSrv } from '@grafana/runtime';
import { Field } from '@grafana/ui';

import { StoreState } from '../../../types';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { VariableLegend } from '../editor/VariableLegend';
import { VariableTextAreaField } from '../editor/VariableTextAreaField';
import { initialVariableEditorState } from '../editor/reducer';
import { getQueryVariableEditorState } from '../editor/selectors';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { isLegacyQueryEditor, isQueryEditor } from '../guard';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { QueryVariableModel, VariableRefresh, VariableSort, VariableWithMultiSupport } from '../types';
import { toKeyedVariableIdentifier } from '../utils';

import { QueryVariableRefreshSelect } from './QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from './QueryVariableSortSelect';
import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';

const mapStateToProps = (state: StoreState, ownProps: OwnProps) => {
  const { rootStateKey } = ownProps.variable;
  if (!rootStateKey) {
    console.error('QueryVariableEditor: variable has no rootStateKey');
    return {
      extended: getQueryVariableEditorState(initialVariableEditorState),
    };
  }

  const { editor } = getVariablesState(rootStateKey, state);

  return {
    extended: getQueryVariableEditorState(editor),
  };
};

const mapDispatchToProps = {
  initQueryVariableEditor,
  changeQueryVariableDataSource,
  changeQueryVariableQuery,
  changeVariableMultiValue,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export interface OwnProps extends VariableEditorProps<QueryVariableModel> {}

export type Props = OwnProps & ConnectedProps<typeof connector>;

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
    await this.props.initQueryVariableEditor(toKeyedVariableIdentifier(this.props.variable));
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (prevProps.variable.datasource !== this.props.variable.datasource) {
      this.props.changeQueryVariableDataSource(
        toKeyedVariableIdentifier(this.props.variable),
        this.props.variable.datasource
      );
    }
  }

  onDataSourceChange = (dsSettings: DataSourceInstanceSettings) => {
    this.props.onPropChange({
      propName: 'datasource',
      propValue: dsSettings.isDefault ? null : getDataSourceRef(dsSettings),
    });
  };

  onLegacyQueryChange = async (query: any, definition: string) => {
    if (this.props.variable.query !== query) {
      this.props.changeQueryVariableQuery(toKeyedVariableIdentifier(this.props.variable), query, definition);
    }
  };

  onQueryChange = async (query: any) => {
    if (this.props.variable.query !== query) {
      let definition = '';

      if (query && query.hasOwnProperty('query') && typeof query.query === 'string') {
        definition = query.query;
      }

      this.props.changeQueryVariableQuery(toKeyedVariableIdentifier(this.props.variable), query, definition);
    }
  };

  onRegExChange = (event: FormEvent<HTMLTextAreaElement>) => {
    this.setState({ regex: event.currentTarget.value });
  };

  onRegExBlur = async (event: FormEvent<HTMLTextAreaElement>) => {
    const regex = event.currentTarget.value;
    if (this.props.variable.regex !== regex) {
      this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
    }
  };

  onRefreshChange = (option: VariableRefresh) => {
    this.props.onPropChange({ propName: 'refresh', propValue: option });
  };

  onSortChange = async (option: SelectableValue<VariableSort>) => {
    this.props.onPropChange({ propName: 'sort', propValue: option.value, updateOptions: true });
  };

  onSelectionOptionsChange = async ({ propValue, propName }: OnPropChangeArguments<VariableWithMultiSupport>) => {
    this.props.onPropChange({ propName, propValue, updateOptions: true });
  };

  renderQueryEditor = () => {
    const { extended, variable } = this.props;

    if (!extended || !extended.dataSource || !extended.VariableQueryEditor) {
      return null;
    }

    const datasource = extended.dataSource;
    const VariableQueryEditor = extended.VariableQueryEditor;

    let query = variable.query;

    if (typeof query === 'string') {
      query = query || (datasource.variables?.getDefaultQuery?.() ?? '');
    } else {
      query = {
        ...datasource.variables?.getDefaultQuery?.(),
        ...variable.query,
      };
    }

    if (isLegacyQueryEditor(VariableQueryEditor, datasource)) {
      return (
        <Field label="Query">
          <VariableQueryEditor
            key={datasource.uid}
            datasource={datasource}
            query={query}
            templateSrv={getTemplateSrv()}
            onChange={this.onLegacyQueryChange}
          />
        </Field>
      );
    }

    const range = getTimeSrv().timeRange();

    if (isQueryEditor(VariableQueryEditor, datasource)) {
      return (
        <Field label="Query">
          <VariableQueryEditor
            key={datasource.uid}
            datasource={datasource}
            query={query}
            onChange={this.onQueryChange}
            onRunQuery={() => {}}
            data={{ series: [], state: LoadingState.Done, timeRange: range }}
            range={range}
            onBlur={() => {}}
            history={[]}
          />
        </Field>
      );
    }

    return null;
  };

  render() {
    return (
      <>
        <VariableLegend>Query options</VariableLegend>
        <Field label="Data source" htmlFor="data-source-picker">
          <DataSourcePicker
            current={this.props.variable.datasource}
            onChange={this.onDataSourceChange}
            variables={true}
            width={30}
          />
        </Field>

        {this.renderQueryEditor()}

        <VariableTextAreaField
          value={this.state.regex ?? this.props.variable.regex}
          name="Regex"
          description={
            <div>
              Optional, if you want to extract part of a series name or metric node segment.
              <br />
              Named capture groups can be used to separate the display text and value (
              <a
                className="external-link"
                href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                target="__blank"
              >
                see examples
              </a>
              ).
            </div>
          }
          placeholder="/.*-(?<text>.*)-(?<value>.*)-.*/"
          onChange={this.onRegExChange}
          onBlur={this.onRegExBlur}
          testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2}
          width={52}
        />

        <QueryVariableSortSelect onChange={this.onSortChange} sort={this.props.variable.sort} />

        <QueryVariableRefreshSelect onChange={this.onRefreshChange} refresh={this.props.variable.refresh} />

        <VariableLegend>Selection options</VariableLegend>
        <SelectionOptionsEditor
          variable={this.props.variable}
          onPropChange={this.onSelectionOptionsChange}
          onMultiChanged={this.props.changeVariableMultiValue}
        />
      </>
    );
  }
}

export const QueryVariableEditor = connector(QueryVariableEditorUnConnected);
