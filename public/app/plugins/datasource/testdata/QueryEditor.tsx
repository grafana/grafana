// Libraries
import React, { PureComponent } from 'react';
import _ from 'lodash';

// Services & Utils
import { getBackendSrv, BackendSrv } from 'app/core/services/backend_srv';

// Components
import { FormLabel, Select, SelectOptionItem } from '@grafana/ui';

// Types
import { QueryEditorProps } from '@grafana/ui/src/types';

interface Scenario {
  id: string;
  name: string;
}

interface State {
  scenarioList: Scenario[];
  current: Scenario | null;
}

export class QueryEditor extends PureComponent<QueryEditorProps> {
  backendSrv: BackendSrv = getBackendSrv();

  state: State = {
    scenarioList: [],
    current: null,
  };

  async componentDidMount() {
    const { query } = this.props;

    query.scenarioId = query.scenarioId || 'random_walk';

    const scenarioList = await this.backendSrv.get('/api/tsdb/testdata/scenarios');
    const current = _.find(scenarioList, { id: query.scenarioId });

    this.setState({ scenarioList: scenarioList, current: current });
  }

  onScenarioChange = (item: SelectOptionItem) => {
    this.props.onQueryChange({
      scenarioId: item.value,
      ...this.props.query
    });
  }

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
