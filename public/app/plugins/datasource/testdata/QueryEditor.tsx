// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Services & Utils
import { getBackendSrv } from '@grafana/runtime';

// Components
import { FormLabel, Select } from '@grafana/ui';
import { QueryEditorProps, SelectableValue } from '@grafana/data';

// Types
import { TestDataDataSource } from './datasource';
import { TestDataQuery, Scenario } from './types';

interface State {
  scenarioList: Scenario[];
  current: Scenario | null;
}

type Props = QueryEditorProps<TestDataDataSource, TestDataQuery>;

export class QueryEditor extends PureComponent<Props> {
  backendSrv = getBackendSrv();

  state: State = {
    scenarioList: [],
    current: null,
  };

  async componentDidMount() {
    const { query, datasource } = this.props;

    query.scenarioId = query.scenarioId || 'random_walk';

    // const scenarioList = await backendSrv.get('/api/tsdb/testdata/scenarios');
    const scenarioList = await datasource.getScenarios();
    const current: any = _.find(scenarioList, { id: query.scenarioId });

    this.setState({ scenarioList: scenarioList, current: current });
  }

  onScenarioChange = (item: SelectableValue<string>) => {
    this.props.onChange({
      ...this.props.query,
      scenarioId: item.value,
    });
  };

  render() {
    const { query } = this.props;
    const options = this.state.scenarioList.map(item => ({ label: item.name, value: item.id }));
    const current = options.find(item => item.value === query.scenarioId);

    return (
      <div className="gf-form-inline">
        <div className="gf-form">
          <FormLabel className="query-keyword" width={7}>
            Scenario
          </FormLabel>
          <Select options={options} value={current} onChange={this.onScenarioChange} />
        </div>
      </div>
    );
  }
}
