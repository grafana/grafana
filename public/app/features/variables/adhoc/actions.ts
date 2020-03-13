import { ThunkResult } from 'app/types';
import { DataSourceSelectItem } from '@grafana/data';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { changeVariableEditorExtended } from '../editor/reducer';

export const initAdHocVariableEditor = (): ThunkResult<void> => async dispatch => {
  const dataSources: DataSourceSelectItem[] = await getDatasourceSrv().getMetricSources();
  const dataSourceTypes = Object.values(
    dataSources.reduce((all: Record<string, {}>, ds) => {
      if (ds.meta.mixed || ds.value === null) {
        return all;
      }

      all[ds.meta.id] = {
        text: ds.meta.name,
        value: ds.meta.id,
      };

      return all;
    }, {})
  );

  dataSourceTypes.unshift({ text: '', value: '' });

  dispatch(
    changeVariableEditorExtended({
      propName: 'dataSourceTypes',
      propValue: dataSourceTypes,
    })
  );
};
