import React from 'react';
import {
  Button,
  Container,
  CustomScrollbar,
  FeatureInfoBox,
  stylesFactory,
  useTheme,
  ValuePicker,
  VerticalGroup,
} from '@grafana/ui';
import {
  DataFrame,
  DataTransformerConfig,
  DocsId,
  FeatureState,
  GrafanaTheme,
  SelectableValue,
  standardTransformersRegistry,
  transformDataFrame,
} from '@grafana/data';
import { TransformationOperationRow } from './TransformationOperationRow';
import { Card, CardProps } from '../../../../core/components/Card/Card';
import { css } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { getDocsLink } from 'app/core/utils/docsLinks';

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

  renderNoAddedTransformsState() {
    return (
      <VerticalGroup spacing={'lg'}>
        <Container grow={1}>
          <FeatureInfoBox
            title="Transformations"
            featureState={FeatureState.beta}
            onDismiss={() => {}}
            url={getDocsLink(DocsId.Transformations)}
          >
            Transformations allow you to join, calculate, re-order, hide and rename your query results before being
            visualized. <br />
            Many transforms are not suitable if your using the Graph visualisation as it currently only supports time
            series. <br />
            It can help to switch to Table visualisation to understand what a transformation is doing. <br />
          </FeatureInfoBox>
        </Container>
        <VerticalGroup>
          {standardTransformersRegistry.list().map(t => {
            return (
              <TransformationCard
                key={t.name}
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
      </VerticalGroup>
    );
  }

  render() {
    const hasTransformationsConfigured = this.props.transformations.length > 0;
    return (
      <CustomScrollbar autoHeightMin="100%">
        <Container padding="md">
          <div aria-label={selectors.components.TransformTab.content}>
            {!hasTransformationsConfigured && this.renderNoAddedTransformsState()}
            {hasTransformationsConfigured && this.renderTransformationEditors()}
            {hasTransformationsConfigured && this.renderTransformationSelector()}
          </div>
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
      border: none;
      padding: ${theme.spacing.sm};

      // hack because these cards use classes from a very different card for some reason
      .add-data-source-item-text {
        font-size: ${theme.typography.size.md};
      }

      &:hover {
        background: ${theme.colors.bg3};
        box-shadow: none;
        border: none;
      }
    `,
  };
});
