import React, { PureComponent } from 'react';
import { DropResult } from 'react-beautiful-dnd';

import { SelectableValue, StandardEditorProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Button, HorizontalGroup } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';
import { LayerDragDropList } from 'app/core/components/Layers/LayerDragDropList';
import { CanvasElementOptions, canvasElementRegistry } from 'app/features/canvas';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { ElementState } from 'app/features/canvas/runtime/element';
import { FrameState } from 'app/features/canvas/runtime/frame';
import { ShowConfirmModalEvent } from 'app/types/events';

import { PanelOptions } from '../models.gen';
import { LayerActionID } from '../types';
import { doSelect } from '../utils';

import { LayerEditorProps } from './layerEditor';

type Props = StandardEditorProps<any, LayerEditorProps, PanelOptions>;

export class LayerElementListEditor extends PureComponent<Props> {
  getScene = () => {
    const { settings } = this.props.item;
    if (!settings?.layer) {
      return;
    }
    return settings.layer.scene;
  };

  onAddItem = (sel: SelectableValue<string>) => {
    const { settings } = this.props.item;
    if (!settings?.layer) {
      return;
    }
    const { layer } = settings;

    const item = canvasElementRegistry.getIfExists(sel.value) ?? notFoundItem;
    const newElementOptions = item.getNewOptions() as CanvasElementOptions;
    newElementOptions.type = item.id;
    const newElement = new ElementState(item, newElementOptions, layer);
    newElement.updateData(layer.scene.context);
    layer.elements.push(newElement);
    layer.scene.save();

    layer.reinitializeMoveable();
  };

  onSelect = (item: ElementState) => {
    const { settings } = this.props.item;
    if (settings?.scene) {
      doSelect(settings.scene, item);
    }
  };

  onClearSelection = () => {
    const { settings } = this.props.item;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    layer.scene.clearCurrentSelection();
  };

  onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const { settings } = this.props.item;
    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    const count = layer.elements.length - 1;
    const src = (result.source.index - count) * -1;
    const dst = (result.destination.index - count) * -1;

    layer.reorder(src, dst);
  };

  goUpLayer = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer || !settings?.scene) {
      return;
    }

    const { scene, layer } = settings;

    if (layer.parent) {
      scene.updateCurrentLayer(layer.parent);
    }
  };

  private decoupleFrame = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    this.deleteFrame();
    layer.elements.forEach((element: ElementState) => {
      const elementContainer = element.div?.getBoundingClientRect();
      element.setPlacementFromConstraint(elementContainer, layer.parent?.div?.getBoundingClientRect());
      layer.parent?.doAction(LayerActionID.Duplicate, element, false, false);
    });
  };

  private onDecoupleFrame = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Decouple frame',
        text: `Are you sure you want to decouple this frame?`,
        text2: 'This will remove the frame and push nested elements in the next level up.',
        confirmText: 'Yes',
        yesText: 'Decouple',
        onConfirm: async () => {
          this.decoupleFrame();
        },
      })
    );
  };

  private deleteFrame = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    const scene = this.getScene();
    scene?.byName.delete(layer.getName());
    layer.elements.forEach((element) => scene?.byName.delete(element.getName()));
    layer.parent?.doAction(LayerActionID.Delete, layer);

    this.goUpLayer();
  };

  private onFrameSelection = () => {
    const scene = this.getScene();
    if (scene) {
      scene.frameSelection();
    } else {
      console.warn('no scene!');
    }
  };

  private onDeleteFrame = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete frame',
        text: `Are you sure you want to delete this frame?`,
        text2: 'This will delete the frame and all nested elements.',
        icon: 'trash-alt',
        confirmText: 'Delete',
        yesText: 'Delete',
        onConfirm: async () => {
          this.deleteFrame();
        },
      })
    );
  };

  render() {
    const settings = this.props.item.settings;
    if (!settings) {
      return <div>No settings</div>;
    }
    const layer = settings.layer;
    if (!layer) {
      return <div>Missing layer?</div>;
    }

    const onDelete = (element: ElementState) => {
      layer.doAction(LayerActionID.Delete, element);
    };

    const onDuplicate = (element: ElementState) => {
      layer.doAction(LayerActionID.Duplicate, element);
    };

    const getLayerInfo = (element: ElementState) => {
      return element.options.type;
    };

    const onNameChange = (element: ElementState, name: string) => {
      element.onChange({ ...element.options, name });
    };

    const showActions = (element: ElementState) => {
      return !(element instanceof FrameState);
    };

    const verifyLayerNameUniqueness = (nameToVerify: string) => {
      const scene = this.getScene();

      return Boolean(scene?.canRename(nameToVerify));
    };

    const selection: string[] = settings.selected ? settings.selected.map((v) => v.getName()) : [];
    return (
      <>
        {!layer.isRoot() && (
          <>
            <Button icon="angle-up" size="sm" variant="secondary" onClick={this.goUpLayer}>
              Go up level
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onSelect(layer)}>
              Select frame
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDecoupleFrame()}>
              Decouple frame
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDeleteFrame()}>
              Delete frame
            </Button>
          </>
        )}
        <LayerDragDropList
          onDragEnd={this.onDragEnd}
          onSelect={this.onSelect}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          getLayerInfo={getLayerInfo}
          onNameChange={onNameChange}
          verifyLayerNameUniqueness={verifyLayerNameUniqueness}
          showActions={showActions}
          layers={layer.elements}
          selection={selection}
        />
        <br />

        <HorizontalGroup>
          <AddLayerButton
            onChange={this.onAddItem}
            options={canvasElementRegistry.selectOptions().options}
            label={'Add item'}
          />
          {selection.length > 0 && (
            <Button size="sm" variant="secondary" onClick={this.onClearSelection}>
              Clear selection
            </Button>
          )}
          {selection.length > 1 && config.featureToggles.canvasPanelNesting && (
            <Button size="sm" variant="secondary" onClick={this.onFrameSelection}>
              Frame selection
            </Button>
          )}
        </HorizontalGroup>
      </>
    );
  }
}
