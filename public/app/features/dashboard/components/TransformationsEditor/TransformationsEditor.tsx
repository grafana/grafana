import { css } from 'emotion';
import React from 'react';
import { transformersUIRegistry } from '@grafana/ui/src/components/TransformersUI/transformers';
import { DataTransformerID, DataTransformerConfig, DataFrame, transformDataFrame } from '@grafana/data';
import { Button, Select } from '@grafana/ui';
import { TransformationRow } from './TransformationRow';

interface Props {
  onChange: (transformations: DataTransformerConfig[]) => void;
  transformations: DataTransformerConfig[];
  dataFrames: DataFrame[];
}

interface State {
  updateCounter: number;
}

export class TransformationsEditor extends React.PureComponent<Props, State> {
  state = { updateCounter: 0 };

  onTransformationAdd = () => {
    const { transformations, onChange } = this.props;
    onChange([
      ...transformations,
      {
        id: DataTransformerID.noop,
        options: {},
      },
    ]);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  onTransformationChange = (idx: number, config: DataTransformerConfig) => {
    const { transformations, onChange } = this.props;
    transformations[idx] = config;
    onChange(transformations);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  onTransformationRemove = (idx: number) => {
    const { transformations, onChange } = this.props;
    transformations.splice(idx, 1);
    onChange(transformations);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  renderTransformationEditors = () => {
    const { transformations, dataFrames } = this.props;
    const hasTransformations = transformations.length > 0;
    const preTransformData = dataFrames;

    if (!hasTransformations) {
      return undefined;
    }

    const availableTransformers = transformersUIRegistry.list().map(t => {
      return {
        value: t.transformer.id,
        label: t.transformer.name,
      };
    });

    return (
      <>
        {transformations.map((t, i) => {
          let editor, input;
          if (t.id === DataTransformerID.noop) {
            return (
              <Select
                className={css`
                  margin-bottom: 10px;
                `}
                key={`${t.id}-${i}`}
                options={availableTransformers}
                placeholder="Select transformation"
                onChange={v => {
                  this.onTransformationChange(i, {
                    id: v.value as string,
                    options: {},
                  });
                }}
              />
            );
          }
          const transformationUI = transformersUIRegistry.getIfExists(t.id);
          input = transformDataFrame(transformations.slice(0, i), preTransformData);

          if (transformationUI) {
            editor = React.createElement(transformationUI.component, {
              options: { ...transformationUI.transformer.defaultOptions, ...t.options },
              input,
              onChange: (options: any) => {
                this.onTransformationChange(i, {
                  id: t.id,
                  options,
                });
              },
            });
          }

          return (
            <TransformationRow
              key={`${t.id}-${i}`}
              input={input || []}
              onRemove={() => this.onTransformationRemove(i)}
              editor={editor}
              name={transformationUI ? transformationUI.name : ''}
              description={transformationUI ? transformationUI.description : ''}
            />
          );
        })}
      </>
    );
  };

  render() {
    return (
      <div className="panel-editor__content">
        <p className="muted text-center" style={{ padding: '8px' }}>
          Transformations allow you to combine, re-order, hide and rename specific parts the the data set before being
          visualized.
        </p>
        {this.renderTransformationEditors()}
        <Button variant="secondary" icon="fa fa-plus" onClick={this.onTransformationAdd}>
          Add transformation
        </Button>
      </div>
    );
  }
}
