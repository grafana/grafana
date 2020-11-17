import React from 'react';
import {
  Alert,
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
  GrafanaTheme,
  PanelData,
  SelectableValue,
  standardTransformersRegistry,
} from '@grafana/data';
import { Card, CardProps } from '../../../../core/components/Card/Card';
import { css } from 'emotion';
import { selectors } from '@grafana/e2e-selectors';
import { Unsubscribable } from 'rxjs';
import { PanelModel } from '../../state';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { TransformationOperationRows } from './TransformationOperationRows';
import { TransformationsEditorTransformation } from './types';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';
import { AppNotificationSeverity } from '../../../../types';

interface TransformationsEditorProps {
  panel: PanelModel;
}

interface State {
  data: DataFrame[];
  transformations: TransformationsEditorTransformation[];
}

export class TransformationsEditor extends React.PureComponent<TransformationsEditorProps, State> {
  subscription?: Unsubscribable;

  constructor(props: TransformationsEditorProps) {
    super(props);
    const transformations = props.panel.transformations || [];

    const ids = this.buildTransformationIds(transformations);
    this.state = {
      transformations: transformations.map((t, i) => ({
        transformation: t,
        id: ids[i],
      })),
      data: [],
    };
  }

  buildTransformationIds(transformations: DataTransformerConfig[]) {
    const transformationCounters: Record<string, number> = {};
    const transformationIds: string[] = [];

    for (let i = 0; i < transformations.length; i++) {
      const transformation = transformations[i];
      if (transformationCounters[transformation.id] === undefined) {
        transformationCounters[transformation.id] = 0;
      } else {
        transformationCounters[transformation.id] += 1;
      }
      transformationIds.push(`${transformations[i].id}-${transformationCounters[transformations[i].id]}`);
    }
    return transformationIds;
  }

  componentDidMount() {
    this.subscription = this.props.panel
      .getQueryRunner()
      .getData({ withTransforms: false, withFieldConfig: false })
      .subscribe({
        next: (panelData: PanelData) => this.setState({ data: panelData.series }),
      });
  }

  componentWillUnmount() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onChange(transformations: TransformationsEditorTransformation[]) {
    this.setState({ transformations });
    this.props.panel.setTransformations(transformations.map(t => t.transformation));
  }

  // Transformation uid are stored in a name-X form. name is NOT unique hence we need to parse the ids and increase X
  // for transformations with the same name
  getTransformationNextId = (name: string) => {
    const { transformations } = this.state;
    let nextId = 0;
    const existingIds = transformations.filter(t => t.id.startsWith(name)).map(t => t.id);

    if (existingIds.length !== 0) {
      nextId = Math.max(...existingIds.map(i => parseInt(i.match(/\d+/)![0], 10))) + 1;
    }

    return `${name}-${nextId}`;
  };

  onTransformationAdd = (selectable: SelectableValue<string>) => {
    const { transformations } = this.state;

    const nextId = this.getTransformationNextId(selectable.value!);
    this.onChange([
      ...transformations,
      {
        id: nextId,
        transformation: {
          id: selectable.value as string,
          options: {},
        },
      },
    ]);
  };

  onTransformationChange = (idx: number, config: DataTransformerConfig) => {
    const { transformations } = this.state;
    const next = Array.from(transformations);
    next[idx].transformation = config;
    this.onChange(next);
  };

  onTransformationRemove = (idx: number) => {
    const { transformations } = this.state;
    const next = Array.from(transformations);
    next.splice(idx, 1);
    this.onChange(next);
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
      <div
        className={css`
          max-width: 66%;
        `}
      >
        <ValuePicker
          size="md"
          variant="secondary"
          label="Add transformation"
          options={availableTransformers}
          onChange={this.onTransformationAdd}
          isFullWidth={false}
          menuPlacement="bottom"
        />
      </div>
    );
  };

  onDragEnd = (result: DropResult) => {
    const { transformations } = this.state;

    if (!result || !result.destination) {
      return;
    }

    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    if (startIndex === endIndex) {
      return;
    }
    const update = Array.from(transformations);
    const [removed] = update.splice(startIndex, 1);
    update.splice(endIndex, 0, removed);
    this.onChange(update);
  };

  renderTransformationEditors = () => {
    const { data, transformations } = this.state;

    return (
      <DragDropContext onDragEnd={this.onDragEnd}>
        <Droppable droppableId="transformations-list" direction="vertical">
          {provided => {
            return (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                <TransformationOperationRows
                  configs={transformations}
                  data={data}
                  onRemove={this.onTransformationRemove}
                  onChange={this.onTransformationChange}
                />
                {provided.placeholder}
              </div>
            );
          }}
        </Droppable>
      </DragDropContext>
    );
  };

  renderNoAddedTransformsState() {
    return (
      <VerticalGroup spacing={'lg'}>
        <Container grow={1}>
          <FeatureInfoBox title="Transformations" url={getDocsLink(DocsId.Transformations)}>
            <p>
              Transformations allow you to join, calculate, re-order, hide and rename your query results before being
              visualized. <br />
              Many transforms are not suitable if you're using the Graph visualization as it currently only supports
              time series. <br />
              It can help to switch to Table visualization to understand what a transformation is doing. <br />
            </p>
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
                ariaLabel={selectors.components.TransformTab.newTransform(t.name)}
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
    const {
      panel: { alert },
    } = this.props;
    const { transformations } = this.state;

    const hasTransforms = transformations.length > 0;

    if (!hasTransforms && alert) {
      return <PanelNotSupported message="Transformations can't be used on a panel with existing alerts" />;
    }

    return (
      <CustomScrollbar autoHeightMin="100%">
        <Container padding="md">
          <div aria-label={selectors.components.TransformTab.content}>
            {hasTransforms && alert ? (
              <Alert
                severity={AppNotificationSeverity.Error}
                title="Transformations can't be used on a panel with alerts"
              />
            ) : null}
            {!hasTransforms && this.renderNoAddedTransformsState()}
            {hasTransforms && this.renderTransformationEditors()}
            {hasTransforms && this.renderTransformationSelector()}
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
