// Libraries
import React, { PureComponent } from 'react';

// Types
import { PanelModel } from '../state/index';
import { PanelData, Button, Select, transformersUIRegistry } from '@grafana/ui';
import { DataFrame, DataTransformerInfo, DataTransformerConfig } from '@grafana/data';
import { JSONFormatter } from 'app/core/components/JSONFormatter/JSONFormatter';

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

    const input = this.getPreTransformData();

    const transformationEditors = transformations.map(t => {
      const editorComponent = transformersUIRegistry.getIfExists(t.id);

      if (editorComponent) {
        return React.createElement(editorComponent.component, {
          key: t.id,
          options: t.options,
          input,
          onChange: (options: any) => {
            this.onChange([
              {
                id: transformations[0].id,
                options,
              },
            ]);
          },
        });
      }
      // undefined?
      return <h1>No ui</h1>;
    });

    return (
      <div>
        <JSONFormatter json={transformations} />
        {transformationEditors}

        <Button variant={'inverse'} onClick={() => this.onChange([])}>
          Remove Transformation
        </Button>
      </div>
    );
  }
}
