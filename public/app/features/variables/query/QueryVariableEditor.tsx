import { FormEvent, PureComponent } from 'react';
import { connect, ConnectedProps } from 'react-redux';

import {
  AppEvents,
  DataSourceInstanceSettings,
  getDataSourceRef,
  QueryVariableModel,
  SelectableValue,
  VariableRefresh,
  VariableSort,
} from '@grafana/data';
import { getAppEvents } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { FEATURE_CONST, getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';
import { QueryVariableEditorForm } from 'app/features/dashboard-scene/settings/variables/components/QueryVariableForm';
import { containsDirectTimeRangeVariables, isServiceManagementQuery } from 'app/features/dashboard-scene/settings/variables/utils';

import { StoreState } from '../../../types';
import { getTimeSrv } from '../../dashboard/services/TimeSrv';
import { initialVariableEditorState } from '../editor/reducer';
import { getQueryVariableEditorState } from '../editor/selectors';
import { VariableEditorProps } from '../editor/types';
import { changeVariableMultiValue } from '../state/actions';
import { getVariablesState } from '../state/selectors';
import { toKeyedVariableIdentifier } from '../utils';

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

  onMultiChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'multi', propValue: event.currentTarget.checked });
  };

  onIncludeAllChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'includeAll', propValue: event.currentTarget.checked, updateOptions: true });
  };

  onAllValueChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'allValue', propValue: event.currentTarget.value });
  };

  onIncludeOnlyAvailable = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'discardForAll', propValue: event.currentTarget.checked, updateOptions: true });
  };

  // BMC code starts
  onBmcVariableCacheChange = (event: FormEvent<HTMLInputElement>) => {
    this.props.onPropChange({ propName: 'bmcVarCache', propValue: event.currentTarget.checked });
  };
  // BMC code ends

  render() {
    const { extended, variable } = this.props;
    if (!extended || !extended.dataSource) {
      return null;
    }

    const timeRange = getTimeSrv().timeRange();

    // BMC code starts - check if enableCachingToggle can be turned on
    let enableVariableCachingToggle = false;
    if (getFeatureStatus(FEATURE_CONST.BHD_ENABLE_VAR_CACHING) && variable?.definition !== '') {
      let errorMsg = '';
      // Only supports service management type queries
      if (isServiceManagementQuery(variable?.query || '')) {
        enableVariableCachingToggle = true;
      } else {
        errorMsg = t(
          'bmc.variables.query-editor.variable-caching.service-management-error',
          'Caching is supported only for Service Management queries'
        );
      }

      // Logic for enabling toggle based on dependencies:
      // 1. If time range is present in variable query -> Toggle is disabled by default

      if (enableVariableCachingToggle) {
        const hasTimeRangeVars = containsDirectTimeRangeVariables(variable?.definition);

        if (hasTimeRangeVars) {
          enableVariableCachingToggle = false;
          errorMsg = t(
            'bmc.variables.query-editor.variable-caching.dependant-error',
            'Caching for time range dependent variables not allowed'
          );
        }
      }

      // Show error if enableVariableCachingToggle is false + property was set to true
      if (!enableVariableCachingToggle && variable?.bmcVarCache) {
        const appEvents = getAppEvents();
        appEvents.publish({
          type: AppEvents.alertError.name,
          payload: [errorMsg],
        });

        // If enableVariableCachingToggle is false + property was set to true, send an event equivalent to the toggle being unchecked to force it being unchecked on UI and dashboard JSON
        this.onBmcVariableCacheChange?.({
          currentTarget: { checked: false },
        } as FormEvent<HTMLInputElement>);
      }
    }
    // BMC code ends

    return (
      <QueryVariableEditorForm
        datasource={variable.datasource ?? undefined}
        onDataSourceChange={this.onDataSourceChange}
        query={variable.query}
        onQueryChange={this.onQueryChange}
        onLegacyQueryChange={this.onLegacyQueryChange}
        timeRange={timeRange}
        regex={variable.regex}
        onRegExChange={this.onRegExBlur}
        sort={variable.sort}
        onSortChange={this.onSortChange}
        refresh={variable.refresh}
        onRefreshChange={this.onRefreshChange}
        isMulti={variable.multi}
        includeAll={variable.includeAll}
        allValue={variable.allValue ?? ''}
        onMultiChange={this.onMultiChange}
        onIncludeAllChange={this.onIncludeAllChange}
        onAllValueChange={this.onAllValueChange}
        // BMC code starts: Below all props
        onIncludeOnlyAvailable={this.onIncludeOnlyAvailable}
        discardForAll={variable.discardForAll}
        // props for BMC variable caching variable
        bmcVarCache={variable?.bmcVarCache || false}
        OnBmcVariableCacheChange={this.onBmcVariableCacheChange}
        enableVariableCachingToggle={enableVariableCachingToggle}
        // BMC code ends
      />
    );
  }
}

export const QueryVariableEditor = connector(QueryVariableEditorUnConnected);
