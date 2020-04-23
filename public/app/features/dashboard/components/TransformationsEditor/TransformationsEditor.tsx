import React from 'react';
import {
  Container,
  CustomScrollbar,
  InfoBox,
  ValuePicker,
  Button,
  useTheme,
  VerticalGroup,
  stylesFactory,
} from '@grafana/ui';
import {
  DataFrame,
  DataTransformerConfig,
  GrafanaTheme,
  SelectableValue,
  standardTransformersRegistry,
  transformDataFrame,
} from '@grafana/data';
import { TransformationOperationRow } from './TransformationOperationRow';
import { Card, CardProps } from '../../../../core/components/Card/Card';
import { css } from 'emotion';

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
            editor = React.createElement(transformationUI.editor, {
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
    const hasTransformationsConfigured = this.props.transformations.length > 0;
    return (
      <CustomScrollbar autoHeightMin="100%">
        <Container padding="md">
          {!hasTransformationsConfigured && (
            <InfoBox>
              <p>
                Transformations allow you to combine, re-order, hide and rename specific parts the the data set before
                being visualized. Choose one of the transformations below to start with:
              </p>
              <VerticalGroup>
                {standardTransformersRegistry.list().map((t, i) => {
                  return (
                    <TransformationCard
                      key={`${t.name}/${i}`}
                      title={t.name}
                      description={t.description}
                      actions={<Button>Select</Button>}
                      onClick={() => {
                        this.onTransformationAdd({ value: t.id });
                      }}
                    />
                  );
                })}
              </VerticalGroup>
            </InfoBox>
          )}
          {hasTransformationsConfigured && this.renderTransformationEditors()}
          {hasTransformationsConfigured && this.renderTransformationSelector()}
        </Container>
      </CustomScrollbar>
    );
  }
}

const TransformationCard: React.FC<CardProps> = props => {
  const theme = useTheme();
  const styles = getTransformationCardStyles(theme);
  return <Card {...props} className={styles.card} />;
};

const getTransformationCardStyles = stylesFactory((theme: GrafanaTheme) => {
  return {
    card: css`
      background: ${theme.colors.bg2};
      width: 100%;
      &:hover {
        background: ${theme.colors.bg3};
      }
    `,
  };
});
