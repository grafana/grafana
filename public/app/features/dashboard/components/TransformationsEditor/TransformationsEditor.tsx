import { css } from '@emotion/css';
import React, { ChangeEvent } from 'react';
import { DragDropContext, Droppable, DropResult } from 'react-beautiful-dnd';
import { Unsubscribable } from 'rxjs';

import {
  DataFrame,
  DataTransformerConfig,
  GrafanaTheme2,
  PanelData,
  SelectableValue,
  standardTransformersRegistry,
  TransformerCategory,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import { Alert, Button, ConfirmModal, Container, CustomScrollbar, Themeable, withTheme, IconButton, ButtonGroup, Box, Text } from '@grafana/ui';
import config from 'app/core/config';
import { Trans } from 'app/core/internationalization';

import { AppNotificationSeverity } from '../../../../types';
import { PanelModel } from '../../state';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';

import { TransformationOperationRows } from './TransformationOperationRows';
import { TransformationPicker } from './TransformationPicker';
import { TransformationPickerNg } from './TransformationPickerNg';
import { TransformationsEditorTransformation } from './types';

interface TransformationsEditorProps extends Themeable {
  panel: PanelModel;
}

const VIEW_ALL_VALUE = 'viewAll';
export type viewAllType = 'viewAll';
export type FilterCategory = TransformerCategory | viewAllType;

interface State {
  data: DataFrame[];
  transformations: TransformationsEditorTransformation[];
  search: string;
  showPicker?: boolean;
  scrollTop?: number;
  showRemoveAllModal?: boolean;
  selectedFilter?: FilterCategory;
  showIllustrations?: boolean;
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
      selectedFilter: VIEW_ALL_VALUE,
      showIllustrations: true,
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

  componentDidUpdate(prevProps: Readonly<TransformationsEditorProps>, prevState: Readonly<State>): void {
    if (config.featureToggles.transformationsRedesign) {
      const prevHasTransforms = prevState.transformations.length > 0;
      const prevShowPicker = !prevHasTransforms || prevState.showPicker;

      const currentHasTransforms = this.state.transformations.length > 0;
      const currentShowPicker = !currentHasTransforms || this.state.showPicker;

      if (prevShowPicker !== currentShowPicker) {
        // kindOfZero will be a random number between 0 and 0.5. It will be rounded to 0 by the scrollable component.
        // We cannot always use 0 as it will not trigger a rerender of the scrollable component consistently
        // due to React changes detection algo.
        const kindOfZero = Math.random() / 2;

        this.setState({ scrollTop: currentShowPicker ? kindOfZero : Number.MAX_SAFE_INTEGER });
      }
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
    let eventName = 'panel_editor_tabs_transformations_management';
    if (config.featureToggles.transformationsRedesign) {
      eventName = 'transformations_redesign_' + eventName;
    }

    reportInteraction(eventName, {
      action: 'add',
      transformationId: selectable.value,
    });
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

  onTransformationChange = (idx: number, dataConfig: DataTransformerConfig) => {
    const { transformations } = this.state;
    const next = Array.from(transformations);
    let eventName = 'panel_editor_tabs_transformations_management';
    if (config.featureToggles.transformationsRedesign) {
      eventName = 'transformations_redesign_' + eventName;
    }

    reportInteraction(eventName, {
      action: 'change',
      transformationId: next[idx].transformation.id,
    });
    next[idx].transformation = dataConfig;
    this.onChange(next);
  };

  onTransformationRemove = (idx: number) => {
    const { transformations } = this.state;
    const next = Array.from(transformations);
    let eventName = 'panel_editor_tabs_transformations_management';
    if (config.featureToggles.transformationsRedesign) {
      eventName = 'transformations_redesign_' + eventName;
    }

    reportInteraction(eventName, {
      action: 'remove',
      transformationId: next[idx].transformation.id,
    });
    next.splice(idx, 1);
    this.onChange(next);
  };

  onTransformationRemoveAll = () => {
    this.onChange([]);
    this.setState({ showRemoveAllModal: false });
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

  renderEmptyMessage = () => {
    return (
      <Box alignItems="center" padding={4}>
        <Flex direction="column" alignItems="center" gap={2}>
          <Text element="h3" textAlignment="center">
            <Trans key="transformations.empty.add-transformation-header">Start transforming data</Trans>
          </Text>
          <Text
            element="p"
            textAlignment="center"
            data-testid={selectors.components.Transforms.noTransformationsMessage}
          >
            <Trans key="transformations.empty.add-transformation-body">
              Transformations allow data to be changed in various ways before your visualization is shown.
              <br />
              This includes joining data together, renaming fields, making calculations, formatting data for
              display, and more.
            </Trans>
          </Text>
          <Button
            icon="plus"
            variant="primary"
            size="md"
            onClick={() => {
              this.setState({ showPicker: true });
            }}
            data-testid={selectors.components.Transforms.addTransformationButton}
          >
            Add transformation
          </Button>
        </Flex>
      </Box>
    )
  }

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
    const { transformations, search, showPicker } = this.state;
    const noTransforms = !transformations?.length;
    let suffix: React.ReactNode = null;
    let xforms = standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

    if (this.state.selectedFilter !== VIEW_ALL_VALUE) {
      xforms = xforms.filter(
        (t) =>
          t.categories &&
          this.state.selectedFilter &&
          t.categories.has(this.state.selectedFilter as TransformerCategory)
      );
    }

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
            tooltip="Clear search"
          />
        </>
      );

      xforms = filtered;
    }

    if (!suffix && showPicker && !noTransforms) {
      suffix = (
        <IconButton
          name="times"
          onClick={() => {
            this.setState({ showPicker: false });
          }}
          tooltip="Close picker"
        />
      );
    }

    const redesignPicker = (
      <TransformationPickerNg
        noTransforms={noTransforms}
        search={search}
        suffix={suffix}
        xforms={xforms}
        setState={this.setState.bind(this)}
        onSearchChange={this.onSearchChange}
        onSearchKeyDown={this.onSearchKeyDown}
        onTransformationAdd={this.onTransformationAdd}
        data={this.state.data}
        selectedFilter={this.state.selectedFilter}
        showIllustrations={this.state.showIllustrations}
      />
    );

    const oldPicker = (
      <TransformationPicker
        noTransforms={noTransforms}
        search={search}
        suffix={suffix}
        xforms={xforms}
        onSearchChange={this.onSearchChange}
        onSearchKeyDown={this.onSearchKeyDown}
        onTransformationAdd={this.onTransformationAdd}
      />
    );

    const { transformationsRedesign } = config.featureToggles;
    const picker = transformationsRedesign ? redesignPicker : oldPicker;

    return (
      <>
        {showPicker && picker}
        <ButtonGroup>
          <Button
            icon="plus"
            variant="secondary"
            onClick={() => {
              this.setState({ showPicker: true });
            }}
            data-testid={selectors.components.Transforms.addTransformationButton}>
            Add another transformation
          </Button>
          <Button
            icon="times"
            variant="secondary"
            onClick={() => this.setState({ showRemoveAllModal: true })}>
            Delete all transformations
          </Button>
        </ButtonGroup>
      </>
    )
  }

  render() {
    const styles = getStyles(config.theme2);
    const {
      panel: { alert },
    } = this.props;
    const { transformations } = this.state;

    const hasTransforms = transformations.length > 0;

    if (!hasTransforms && alert) {
      return <PanelNotSupported message="Transformations can't be used on a panel with existing alerts" />;
    }

    return (
      <CustomScrollbar scrollTop={this.state.scrollTop} autoHeightMin="100%">
        <Container padding="lg">
          <div data-testid={selectors.components.TransformTab.content}>
            {hasTransforms && alert ? (
              <Alert
                severity={AppNotificationSeverity.Error}
                title="Transformations can't be used on a panel with alerts"
              />
            ) : null}
            {!hasTransforms && config.featureToggles.transformationsRedesign &&
              <div>Empty message here</div>
            }
            {hasTransforms && config.featureToggles.transformationsRedesign && !this.state.showPicker && (
              <div className={styles.listInformationLineWrapper}>
                {/* <span className={styles.listInformationLineText}>Transformations in use</span>{' '} */}
                {/* <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    this.setState({ showRemoveAllModal: true });
                  }}
                >
                  Delete all transformations
                </Button> */}
                <ConfirmModal
                  isOpen={Boolean(this.state.showRemoveAllModal)}
                  title="Delete all transformations?"
                  body="By deleting all transformations, you will go back to the main selection screen."
                  confirmText="Delete all"
                  onConfirm={() => this.onTransformationRemoveAll()}
                  onDismiss={() => this.setState({ showRemoveAllModal: false })}
                />
              </div>
            )}
            {hasTransforms && this.renderTransformationEditors()}
            {this.renderTransformsPicker()}
          </div>
        </Container>
      </CustomScrollbar>
    );
  }
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    hide: css({
      display: 'none',
    }),
    listInformationLineWrapper: css({
      display: 'flex',
      justifyContent: 'space-between',
      marginBottom: '24px',
    }),
    listInformationLineText: css({
      fontSize: '16px',
    }),
  };
};

export const TransformationsEditor = withTheme(UnThemedTransformationsEditor);
