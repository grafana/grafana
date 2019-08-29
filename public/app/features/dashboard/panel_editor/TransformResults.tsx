// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/index';
import { PanelData, Button, Select, StatsPicker } from '@grafana/ui';
import { DataFrame, DataTransformerInfo, DataTransformerConfig, DataTransformerID } from '@grafana/data';
// import { ByNameTransform } from './ByNameTransform';
// import { TransformationConfig } from '../state/PanelModel';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';
import { ReduceOptions } from '@grafana/data/src/utils/transformers/reduce';

interface Props {
  panel: PanelModel;
  data: PanelData;
  transformers: Array<DataTransformerInfo<any>>;
  onChange: (value: DataTransformerConfig[]) => void;
}

interface State {
  updateCounter: number;
}

export class TransformResults extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { updateCounter: 0 };
  }

  private getPreTransformData(): DataFrame[] {
    const { panel } = this.props;
    return panel.getQueryRunner().getCurrentData(false).series;
  }

  onChange = (config: DataTransformerConfig[]) => {
    const { onChange } = this.props;
    onChange(config);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  onAddTransform = (id: string) => {
    this.onChange([
      {
        id,
        options: {},
      },
    ]);
  };

  renderTransformersSelect = () => {
    const { transformers } = this.props;

    const options = transformers.map(t => {
      return {
        value: t.id,
        label: t.name,
      };
    });
    return (
      <>
        <Select
          options={options}
          placeholder="Add Transformation"
          onChange={v => {
            this.onAddTransform(v.value);
          }}
        />
      </>
    );
  };

  render() {
    const { panel } = this.props;
    const { transformations } = panel;

    if (!transformations || transformations.length === 0) {
      return this.renderTransformersSelect();
    }

    // TODO pass to any transformer UI
    // @ts-ignore
    const input = this.getPreTransformData();

    return (
      <div>
        {/* <ByNameTransform input={input} config={transformation[0]} onChange={this.onChange} /> */}
        <JSONFormatter json={transformations} />

        {/* TODO: now works with reduce transformation */}
        {transformations[0].id === DataTransformerID.reduce && (
          <ReduceOptions
            options={transformations[0].options}
            onChange={options => {
              this.onChange([
                {
                  id: transformations[0].id,
                  options,
                },
              ]);
            }}
          />
        )}
        <Button variant={'inverse'} onClick={() => this.onChange([])}>
          Remove Transformation
        </Button>
      </div>
    );
  }
}

const ReduceOptions = ({
  options,
  onChange,
}: {
  options: ReduceOptions;
  onChange: (options: ReduceOptions) => void;
}) => {
  console.log('options', options);
  return (
    <StatsPicker
      width={12}
      placeholder="Choose Stat"
      allowMultiple
      stats={options.reducers || []}
      onChange={stats => {
        onChange({
          ...options,
          reducers: stats,
        });
      }}
    />
  );
};
