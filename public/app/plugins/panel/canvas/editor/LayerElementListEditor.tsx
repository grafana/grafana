import React, { PureComponent } from 'react';
import { Button, HorizontalGroup } from '@grafana/ui';
import { AppEvents, SelectableValue, StandardEditorProps } from '@grafana/data';
import { DropResult } from 'react-beautiful-dnd';

import { PanelOptions } from '../models.gen';
import { LayerActionID } from '../types';
import { CanvasElementOptions, canvasElementRegistry } from 'app/features/canvas';
import appEvents from 'app/core/app_events';
import { ElementState } from 'app/features/canvas/runtime/element';
import { notFoundItem } from 'app/features/canvas/elements/notFound';
import { GroupState } from 'app/features/canvas/runtime/group';
import { LayerEditorProps } from './layerEditor';
import { SelectionParams } from 'app/features/canvas/runtime/scene';
import { ShowConfirmModalEvent } from 'app/types/events';
import { LayerDragDropList } from 'app/core/components/Layers/LayerDragDropList';
import { AddLayerButton } from 'app/core/components/Layers/AddLayerButton';

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
    newElement.updateSize(newElement.width, newElement.height);
    newElement.updateData(layer.scene.context);
    layer.elements.push(newElement);
    layer.scene.save();

    layer.reinitializeMoveable();
  };

  onSelect = (item: any) => {
    const { settings } = this.props.item;

    if (settings?.scene) {
      try {
        let selection: SelectionParams = { targets: [] };
        if (item instanceof GroupState) {
          const targetElements: HTMLDivElement[] = [];
          item.elements.forEach((element: ElementState) => {
            targetElements.push(element.div!);
          });

          selection.targets = targetElements;
          selection.group = item;
          settings.scene.select(selection);
        } else if (item instanceof ElementState) {
          const targetElement = [item?.div!];
          selection.targets = targetElement;
          settings.scene.select(selection);
        }
      } catch (error) {
        appEvents.emit(AppEvents.alertError, ['Unable to select element, try selecting element in panel instead']);
      }
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

  private decoupleGroup = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    layer.elements.forEach((element: ElementState) => {
      layer.parent?.doAction(LayerActionID.Duplicate, element, false);
    });
    this.deleteGroup();
  };

  private onDecoupleGroup = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Decouple group',
        text: `Are you sure you want to decouple this group?`,
        text2: 'This will remove the group and push nested elements in the next level up.',
        confirmText: 'Yes',
        yesText: 'Decouple',
        onConfirm: async () => {
          this.decoupleGroup();
        },
      })
    );
  };

  private deleteGroup = () => {
    const settings = this.props.item.settings;

    if (!settings?.layer) {
      return;
    }

    const { layer } = settings;

    const scene = this.getScene();
    scene?.byName.delete(layer.getName());
    layer.parent?.doAction(LayerActionID.Delete, layer);

    this.goUpLayer();
  };

  private onGroupSelection = () => {
    const scene = this.getScene();
    if (scene) {
      scene.groupSelection();
    } else {
      console.warn('no scene!');
    }
  };

  private onDeleteGroup = () => {
    appEvents.publish(
      new ShowConfirmModalEvent({
        title: 'Delete group',
        text: `Are you sure you want to delete this group?`,
        text2: 'This will delete the group and all nested elements.',
        icon: 'trash-alt',
        confirmText: 'Delete',
        yesText: 'Delete',
        onConfirm: async () => {
          this.deleteGroup();
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

    const isGroup = (element: ElementState) => {
      return element instanceof GroupState;
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
              Go Up Level
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onSelect(layer)}>
              Select Group
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDecoupleGroup()}>
              Decouple Group
            </Button>
            <Button size="sm" variant="secondary" onClick={() => this.onDeleteGroup()}>
              Delete Group
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
          isGroup={isGroup}
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
              Clear Selection
            </Button>
          )}
          {selection.length > 1 && (
            <Button size="sm" variant="secondary" onClick={this.onGroupSelection}>
              Group items
            </Button>
          )}
        </HorizontalGroup>
      </>
    );
  }
}
