import React from 'react';
import { Container, CustomScrollbar, ValuePicker } from '@grafana/ui';
import {
  DataFrame,
  DataTransformerConfig,
  SelectableValue,
  standardTransformersRegistry,
  transformDataFrame,
} from '@grafana/data';
import { TransformationOperationRow } from './TransformationOperationRow';

interface Props {
  onChange: (transformations: DataTransformerConfig[]) => void;
  transformations: DataTransformerConfig[];
  dataFrames: DataFrame[];
}

export class TransformationsEditor extends React.PureComponent<Props> {
  onTransformationAdd = (selectable: SelectableValue<string>) => {
    const { transformations, onChange } = this.props;
    onChange([
      ...transformations,
      {
        id: selectable.value as string,
        options: {},
      },
    ]);
  };

  onTransformationChange = (idx: number, config: DataTransformerConfig) => {
    const { transformations, onChange } = this.props;
    const next = Array.from(transformations);
    next[idx] = config;
    onChange(next);
  };

  onTransformationRemove = (idx: number) => {
    const { transformations, onChange } = this.props;
    const next = Array.from(transformations);
    next.splice(idx, 1);
    onChange(next);
  };

  renderTransformationSelector = () => {
    const availableTransformers = standardTransformersRegistry.list().map(t => {
      return {
        value: t.transformation.id,
        label: t.name,
        description: t.description,
      };
    });

    return (
      <ValuePicker
        size="md"
        variant="secondary"
        label="Add transformation"
        options={availableTransformers}
        onChange={this.onTransformationAdd}
        isFullWidth={false}
      />
    );
  };

  renderTransformationEditors = () => {
    const { transformations, dataFrames } = this.props;
    const preTransformData = dataFrames;

    return (
      <>
        {transformations.map((t, i) => {
          let editor;

          const transformationUI = standardTransformersRegistry.getIfExists(t.id);
          if (!transformationUI) {
            return null;
          }

          const input = transformDataFrame(transformations.slice(0, i), preTransformData);
          const output = transformDataFrame(transformations.slice(i), input);

          if (transformationUI) {
            editor = React.createElement(transformationUI.component, {
              options: { ...transformationUI.transformation.defaultOptions, ...t.options },
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
            <TransformationOperationRow
              key={`${t.id}-${i}`}
              input={input || []}
              output={output || []}
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
      <CustomScrollbar autoHeightMin="100%">
        <Container padding="md">
          <p className="muted text-center" style={{ padding: '8px' }}>
            Transformations allow you to combine, re-order, hide and rename specific parts the the data set before being
            visualized.
          </p>
          {this.renderTransformationEditors()}
          {this.renderTransformationSelector()}
        </Container>
      </CustomScrollbar>
    );
  }
}
