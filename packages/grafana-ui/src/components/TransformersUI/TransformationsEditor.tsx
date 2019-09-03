import { DataTransformerID, DataTransformerConfig, dataTransformers, DataFrame } from '@grafana/data';
import { Select } from '../Select/Select';
import { transformersUIRegistry } from './transformers';
import React from 'react';
import { TransformationRow } from './TransformationRow';
import { Button } from '../Button/Button';

interface TransformationsEditorState {
  updateCounter: number;
}

interface TransformationsEditorProps {
  onChange: (transformations: DataTransformerConfig[]) => void;
  transformations: DataTransformerConfig[];
  getCurrentData: (depth?: number) => DataFrame[];
}
export class TransformationsEditor extends React.PureComponent<TransformationsEditorProps, TransformationsEditorState> {
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
    console.log('CHANGING:', idx, config);
    const { transformations, onChange } = this.props;
    transformations[idx] = config;
    onChange(transformations);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  onTransformationRemove = (idx: number) => {
    console.log('Removing:', idx);
    const { transformations, onChange } = this.props;
    transformations.splice(idx, 1);
    onChange(transformations);
    this.setState({ updateCounter: this.state.updateCounter + 1 });
  };

  renderTransformationEditors = () => {
    const { transformations, getCurrentData } = this.props;
    const hasTransformations = transformations.length > 0;

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
                key={`${t.id}-${i}`}
                options={availableTransformers}
                placeholder="Add Transformation"
                onChange={v => {
                  this.onTransformationChange(i, {
                    id: v.value as string,
                    options: {},
                  });
                }}
              />
            );
          }
          const transforationUI = transformersUIRegistry.getIfExists(t.id);

          if (transforationUI) {
            editor = React.createElement(transforationUI.component, {
              key: `${t.id}-${i}`, // this key is making troubles when the same transformers are next to each other and one is removed
              options: t.options,
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
              input={input || []}
              onRemove={() => this.onTransformationRemove(i)}
              editor={editor}
              name={transforationUI ? transforationUI.name : ''}
              description={transforationUI ? transforationUI.description : ''}
            />
          );
        })}
      </>
    );
  };

  render() {
    return (
      <>
        {this.renderTransformationEditors()}
        <Button variant="inverse" icon="fa fa-plus" onClick={this.onTransformationAdd}>
          Add transformation
        </Button>
      </>
    );
  }
}
