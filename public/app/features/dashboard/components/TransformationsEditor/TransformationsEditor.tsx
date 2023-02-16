import { css } from '@emotion/css';
import React, { ChangeEvent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Unsubscribable } from 'rxjs';

import {
  DataFrame,
  DataTransformerConfig,
  DocsId,
  GrafanaTheme2,
  PanelData,
  SelectableValue,
  standardTransformersRegistry,
  TransformerRegistryItem,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import {
  Alert,
  Button,
  Container,
  CustomScrollbar,
  Themeable,
  VerticalGroup,
  withTheme,
  Input,
  IconButton,
  useStyles2,
  Card,
} from '@grafana/ui';
import { LocalStorageValueProvider } from 'app/core/components/LocalStorageValueProvider';
import { getDocsLink } from 'app/core/utils/docsLinks';
import { PluginStateInfo } from 'app/features/plugins/components/PluginStateInfo';

import { AppNotificationSeverity } from '../../../../types';
import { PanelModel } from '../../state';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';

import { TransformationOperationRows } from './TransformationOperationRows';
import { TransformationsEditorTransformation } from './types';

const LOCAL_STORAGE_KEY = 'dashboard.components.TransformationEditor.featureInfoBox.isDismissed';

interface TransformationsEditorProps extends Themeable {
  panel: PanelModel;
}

interface State {
  data: DataFrame[];
  transformations: TransformationsEditorTransformation[];
  search: string;
  showPicker?: boolean;
}

class UnThemedTransformationsEditor extends React.PureComponent<TransformationsEditorProps, State> {
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
      search: '',
    };
  }

  onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    this.setState({ search: event.target.value });
  };

  onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const { search } = this.state;
      if (search) {
        const lower = search.toLowerCase();
        const filtered = standardTransformersRegistry.list().filter((t) => {
          const txt = (t.name + t.description).toLowerCase();
          return txt.indexOf(lower) >= 0;
        });
        if (filtered.length > 0) {
          this.onTransformationAdd({ value: filtered[0].id });
        }
      }
    } else if (event.keyCode === 27) {
      // Escape key
      this.setState({ search: '', showPicker: false });
      event.stopPropagation(); // don't exit the editor
    }
  };

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
    this.props.panel.setTransformations(transformations.map((t) => t.transformation));
  }

  // Transformation UIDs are stored in a name-X form. name is NOT unique hence we need to parse the IDs and increase X
  // for transformations with the same name
  getTransformationNextId = (name: string) => {
    const { transformations } = this.state;
    let nextId = 0;
    const existingIds = transformations.filter((t) => t.id.startsWith(name)).map((t) => t.id);

    if (existingIds.length !== 0) {
      nextId = Math.max(...existingIds.map((i) => parseInt(i.match(/\d+/)![0], 10))) + 1;
    }

    return `${name}-${nextId}`;
  };

  onTransformationAdd = (selectable: SelectableValue<string>) => {
    const { transformations } = this.state;

    const nextId = this.getTransformationNextId(selectable.value!);
    this.setState({ search: '', showPicker: false });
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
          {(provided) => {
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

  renderTransformsPicker() {
    const { transformations, search } = this.state;
    let suffix: React.ReactNode = null;
    let xforms = standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

    if (search) {
      const lower = search.toLowerCase();
      const filtered = xforms.filter((t) => {
        const txt = (t.name + t.description).toLowerCase();
        return txt.indexOf(lower) >= 0;
      });

      suffix = (
        <>
          {filtered.length} / {xforms.length} &nbsp;&nbsp;
          <IconButton
            name="times"
            onClick={() => {
              this.setState({ search: '' });
            }}
          />
        </>
      );

      xforms = filtered;
    }

    const noTransforms = !transformations?.length;
    const showPicker = noTransforms || this.state.showPicker;

    if (!suffix && showPicker && !noTransforms) {
      suffix = (
        <IconButton
          name="times"
          onClick={() => {
            this.setState({ showPicker: false });
          }}
        />
      );
    }

    return (
      <>
        {noTransforms && (
          <Container grow={1}>
            <LocalStorageValueProvider<boolean> storageKey={LOCAL_STORAGE_KEY} defaultValue={false}>
              {(isDismissed, onDismiss) => {
                if (isDismissed) {
                  return null;
                }

                return (
                  <Alert
                    title="Transformations"
                    severity="info"
                    onRemove={() => {
                      onDismiss(true);
                    }}
                  >
                    <p>
                      Transformations allow you to join, calculate, re-order, hide, and rename your query results before
                      they are visualized. <br />
                      Many transforms are not suitable if you&apos;re using the Graph visualization, as it currently
                      only supports time series data. <br />
                      It can help to switch to the Table visualization to understand what a transformation is doing.{' '}
                    </p>
                    <a
                      href={getDocsLink(DocsId.Transformations)}
                      className="external-link"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read more
                    </a>
                  </Alert>
                );
              }}
            </LocalStorageValueProvider>
          </Container>
        )}
        {showPicker ? (
          <VerticalGroup>
            <Input
              aria-label={selectors.components.Transforms.searchInput}
              value={search ?? ''}
              autoFocus={!noTransforms}
              placeholder="Add transformation"
              onChange={this.onSearchChange}
              onKeyDown={this.onSearchKeyDown}
              suffix={suffix}
            />

            {xforms.map((t) => {
              return (
                <TransformationCard
                  key={t.name}
                  transform={t}
                  onClick={() => {
                    this.onTransformationAdd({ value: t.id });
                  }}
                />
              );
            })}
          </VerticalGroup>
        ) : (
          <Button
            icon="plus"
            variant="secondary"
            onClick={() => {
              this.setState({ showPicker: true });
            }}
          >
            Add transformation
          </Button>
        )}
      </>
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
            {hasTransforms && this.renderTransformationEditors()}
            {this.renderTransformsPicker()}
          </div>
        </Container>
      </CustomScrollbar>
    );
  }
}

interface TransformationCardProps {
  transform: TransformerRegistryItem<any>;
  onClick: () => void;
}

function TransformationCard({ transform, onClick }: TransformationCardProps) {
  const styles = useStyles2(getStyles);
  return (
    <Card
      className={styles.card}
      aria-label={selectors.components.TransformTab.newTransform(transform.name)}
      onClick={onClick}
    >
      <Card.Heading>{transform.name}</Card.Heading>
      <Card.Description>{transform.description}</Card.Description>
      {transform.state && (
        <Card.Tags>
          <PluginStateInfo state={transform.state} />
        </Card.Tags>
      )}
    </Card>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    card: css`
      margin: 0;
      padding: ${theme.spacing(1)};
    `,
  };
};

export const TransformationsEditor = withTheme(UnThemedTransformationsEditor);
