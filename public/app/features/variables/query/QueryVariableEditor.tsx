import React, { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';
import { css } from '@emotion/css';
import { InlineField, InlineFieldRow, VerticalGroup } from '@grafana/ui';
import { selectors } from '@grafana/e2e-selectors';
import { DataSourcePicker, getTemplateSrv } from '@grafana/runtime';
import { DataSourceInstanceSettings, getDataSourceRef, LoadingState, SelectableValue } from '@grafana/data';

import { SelectionOptionsEditor } from '../editor/SelectionOptionsEditor';
import { QueryVariableModel, VariableRefresh, VariableSort, VariableWithMultiSupport } from '../types';
import { changeQueryVariableDataSource, changeQueryVariableQuery, initQueryVariableEditor } from './actions';
import { initialVariableEditorState } from '../editor/reducer';
import { OnPropChangeArguments, VariableEditorProps } from '../editor/types';
import { StoreState } from '../../../types';
import { changeVariableMultiValue } from '../state/actions';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { isLegacyQueryEditor, isQueryEditor } from '../guard';
import { VariableSectionHeader } from '../editor/VariableSectionHeader';
import { VariableTextField } from '../editor/VariableTextField';
import { QueryVariableRefreshSelect } from './QueryVariableRefreshSelect';
import { QueryVariableSortSelect } from './QueryVariableSortSelect';
import { getQueryVariableEditorState } from '../editor/selectors';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

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

  onRegExChange = (event: FormEvent<HTMLInputElement>) => {
    this.setState({ regex: event.currentTarget.value });
  };

  onRegExBlur = async (event: FormEvent<HTMLInputElement>) => {
    const regex = event.currentTarget.value;
    if (this.props.variable.regex !== regex) {
      this.props.onPropChange({ propName: 'regex', propValue: regex, updateOptions: true });
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

  renderQueryEditor = () => {
    const { extended, variable } = this.props;

    if (!extended || !extended.dataSource || !extended.VariableQueryEditor) {
      return null;
    }

    const query = variable.query;
    const datasource = extended.dataSource;
    const VariableQueryEditor = extended.VariableQueryEditor;

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
              <InlineField label="Data source" labelWidth={20} htmlFor="data-source-picker">
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
                    className="external-link"
                    href="https://grafana.com/docs/grafana/latest/variables/filter-variables-with-regex#filter-and-modify-using-named-text-and-value-capture-groups"
                    target="__blank"
                  >
                    see examples
                  </a>
                  ).
                </div>
              }
              testId={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRegExInputV2}
              grow
            />
            <QueryVariableSortSelect onChange={this.onSortChange} sort={this.props.variable.sort} />
          </VerticalGroup>

          <SelectionOptionsEditor
            variable={this.props.variable}
            onPropChange={this.onSelectionOptionsChange}
            onMultiChanged={this.props.changeVariableMultiValue}
          />
        </VerticalGroup>
      </VerticalGroup>
    );
  }
}

export const QueryVariableEditor = connector(QueryVariableEditorUnConnected);
