import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { ChangeEvent, createRef, RefObject } from 'react';
import * as React from 'react';
import { Unsubscribable } from 'rxjs';

import {
  DataFrame,
  DataTransformerConfig,
  PanelData,
  SelectableValue,
  standardTransformersRegistry,
  TransformerCategory,
} from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { reportInteraction } from '@grafana/runtime';
import {
  Button,
  ConfirmModal,
  Container,
  Themeable,
  withTheme,
  IconButton,
  ButtonGroup,
  ScrollContainer,
} from '@grafana/ui';
import config from 'app/core/config';
import { EmptyTransformationsMessage } from 'app/features/dashboard-scene/panel-edit/PanelDataPane/EmptyTransformationsMessage';

import { PanelModel } from '../../state/PanelModel';
import { PanelNotSupported } from '../PanelEditor/PanelNotSupported';

import { TransformationOperationRows } from './TransformationOperationRows';
import { TransformationPicker } from './TransformationPicker';
import { TransformationPickerNg } from './TransformationPickerNg';
import { TransformationsEditorTransformation } from './types';

interface TransformationsEditorProps extends Themeable {
  panel: PanelModel;
}

export const VIEW_ALL_VALUE = 'viewAll';
export type viewAllType = 'viewAll';
export type FilterCategory = TransformerCategory | viewAllType;

export interface TransformationData {
  series: DataFrame[];
  annotations?: DataFrame[];
}

interface State {
  data: TransformationData;
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
  ref: RefObject<HTMLDivElement>;

  constructor(props: TransformationsEditorProps) {
    super(props);
    const transformations = props.panel.transformations || [];

    const ids = this.buildTransformationIds(transformations);
    this.state = {
      transformations: transformations.map((t, i) => ({
        transformation: t,
        id: ids[i],
      })),
      data: {
        series: [],
      },
      search: '',
      selectedFilter: VIEW_ALL_VALUE,
      showIllustrations: true,
    };
    this.ref = createRef<HTMLDivElement>();
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
        next: (panelData: PanelData) => this.setState({ data: panelData }),
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

    if (prevState.scrollTop !== this.state.scrollTop) {
      this.ref.current?.scrollTo({ top: this.state.scrollTop });
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
      <EmptyTransformationsMessage
        onShowPicker={() => {
          this.setState({ showPicker: true });
        }}
      ></EmptyTransformationsMessage>
    );
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
    let { showPicker } = this.state;
    const { transformations, search } = this.state;
    const { transformationsRedesign } = config.featureToggles;
    const noTransforms = !transformations?.length;
    const hasTransforms = transformations.length > 0;
    let suffix: React.ReactNode = null;
    let xforms = standardTransformersRegistry.list().sort((a, b) => (a.name > b.name ? 1 : b.name > a.name ? -1 : 0));

    // In the case we're not on the transformation
    // redesign and there are no transformations
    // then we show the picker in that case
    if (!transformationsRedesign && noTransforms) {
      showPicker = true;
    }

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

    // If we're in the transformation redesign
    // we have the add transformation add the
    // delete all control
    let picker = null;
    let deleteAll = null;
    if (transformationsRedesign) {
      picker = (
        <TransformationPickerNg
          noTransforms={noTransforms}
          search={search}
          suffix={suffix}
          xforms={xforms}
          onClose={() => this.setState({ showPicker: false })}
          onSelectedFilterChange={(filter) => this.setState({ selectedFilter: filter })}
          onShowIllustrationsChange={(showIllustrations) => this.setState({ showIllustrations })}
          onSearchChange={this.onSearchChange}
          onSearchKeyDown={this.onSearchKeyDown}
          onTransformationAdd={this.onTransformationAdd}
          data={this.state.data.series}
          selectedFilter={this.state.selectedFilter}
          showIllustrations={this.state.showIllustrations}
        />
      );

      deleteAll = (
        <>
          <Button
            icon="times"
            variant="secondary"
            onClick={() => this.setState({ showRemoveAllModal: true })}
            style={{ marginLeft: this.props.theme.spacing.md }}
          >
            Delete all transformations
          </Button>
          <ConfirmModal
            isOpen={Boolean(this.state.showRemoveAllModal)}
            title="Delete all transformations?"
            body="By deleting all transformations, you will go back to the main selection screen."
            confirmText="Delete all"
            onConfirm={() => this.onTransformationRemoveAll()}
            onDismiss={() => this.setState({ showRemoveAllModal: false })}
          />
        </>
      );
    }
    // Otherwise we use the old picker
    else {
      picker = (
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
    }

    // Compose actions, if we're in the
    // redesign a "Delete All Transformations"
    // button (with confirm modal) is added
    const actions = (
      <ButtonGroup>
        <Button
          icon="plus"
          variant="secondary"
          onClick={() => {
            this.setState({ showPicker: true });
          }}
          data-testid={selectors.components.Transforms.addTransformationButton}
        >
          Add another transformation
        </Button>
        {deleteAll}
      </ButtonGroup>
    );

    return (
      <>
        {showPicker && picker}
        {
          // If the transformation redesign is enabled
          // and there are transforms then show actions
          (transformationsRedesign && hasTransforms && actions) ||
            // If it's not enabled only show actions when there are
            // transformations and the (old) picker isn't being shown
            (!transformationsRedesign && !showPicker && hasTransforms && actions)
        }
      </>
    );
  }

  render() {
    const {
      panel: { alert },
    } = this.props;
    const { transformations } = this.state;
    const hasTransforms = transformations.length > 0;

    // If there are any alerts then
    // we can't use transformations
    if (alert) {
      const message = hasTransforms
        ? "Transformations can't be used on a panel with alerts"
        : "Transformations can't be used on a panel with existing alerts";
      return <PanelNotSupported message={message} />;
    }

    return (
      <ScrollContainer ref={this.ref} minHeight="100%">
        <Container padding="lg">
          <div data-testid={selectors.components.TransformTab.content}>
            {!hasTransforms && config.featureToggles.transformationsRedesign && this.renderEmptyMessage()}
            {hasTransforms && this.renderTransformationEditors()}
            {this.renderTransformsPicker()}
          </div>
        </Container>
      </ScrollContainer>
    );
  }
}

export const TransformationsEditor = withTheme(UnThemedTransformationsEditor);
