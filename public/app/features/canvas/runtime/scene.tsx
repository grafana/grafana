import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
import { ReplaySubject } from 'rxjs';
import Moveable from 'moveable';
import Selecto from 'selecto';

import { config } from 'app/core/config';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { CanvasElementOptions, CanvasGroupOptions, DEFAULT_CANVAS_ELEMENT_CONFIG } from 'app/features/canvas';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
  DimensionContext,
} from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getScaleDimensionFromData,
  getResourceDimensionFromData,
  getTextDimensionFromData,
} from 'app/features/dimensions/utils';
import { GroupState } from './group';
import { ElementState } from './element';

export class Scene {
  private root: GroupState;
  private lookup = new Map<number, ElementState>();
  styles = getStyles(config.theme2);
  readonly selected = new ReplaySubject<ElementState | undefined>(undefined);
  revId = 0;

  width = 0;
  height = 0;
  style: CSSProperties = {};
  data?: PanelData;

  constructor(cfg: CanvasGroupOptions, public onSave: (cfg: CanvasGroupOptions) => void) {
    this.root = this.load(cfg);
  }

  load(cfg: CanvasGroupOptions) {
    console.log('LOAD', cfg, this);
    this.root = new GroupState(
      cfg ?? {
        type: 'group',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      }
    );

    // Build the scene registry
    this.lookup.clear();
    this.root.visit((v) => {
      this.lookup.set(v.UID, v);

      // HACK! select the first/only item
      if (v.item.id !== 'group') {
        this.selected.next(v);
      }
    });
    return this.root;
  }

  context: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.data, scale),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.data, res),
  };

  updateData(data: PanelData) {
    this.data = data;
    this.root.updateData(this.context);
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.style = { width, height };
    this.root.updateSize(width, height);
  }

  onChange(uid: number, cfg: CanvasElementOptions) {
    const elem = this.lookup.get(uid);
    if (!elem) {
      throw new Error('element not found: ' + uid + ' // ' + [...this.lookup.keys()]);
    }
    this.revId++;
    elem.onChange(cfg);
    elem.updateData(this.context); // Refresh any data that may have changed
    this.save();
  }

  save() {
    this.onSave(this.root.getSaveModel());
  }

  private findElementByTarget = (target: HTMLElement | SVGElement): ElementState | undefined => {
    return this.root.elements.find((element) => element.div === target);
  };

  initMoveable = (sceneContainer: HTMLDivElement) => {
    const targetElements: HTMLDivElement[] = [];
    this.root.elements.forEach((element: ElementState) => {
      targetElements.push(element.div!);
    });

    const selecto = new Selecto({
      container: sceneContainer,
      selectableTargets: targetElements,
    });

    const moveable = new Moveable(sceneContainer, {
      draggable: true,
      resizable: true,
    })
      .on('clickGroup', (event) => {
        selecto.clickTarget(event.inputEvent, event.inputTarget);
      })
      .on('drag', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyDrag(event);
      })
      .on('dragGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyDrag(event);
        });
      })
      .on('resize', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyResize(event);
      })
      .on('resizeGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyResize(event);
        });
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    selecto
      .on('dragStart', (event) => {
        const selectedTarget = event.inputEvent.target;

        const isTargetMoveableElement =
          moveable.isMoveableElement(selectedTarget) ||
          targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

        if (isTargetMoveableElement) {
          // Prevent drawing selection box when selected target is a moveable element
          event.stop();
        }
      })
      .on('selectEnd', (event) => {
        targets = event.selected;
        moveable.target = targets;

        if (event.isDragStart) {
          event.inputEvent.preventDefault();

          setTimeout(() => {
            moveable.dragStart(event.inputEvent);
          });
        }
      });
  };

  render() {
    return (
      <div>
        <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.initMoveable}>
          {this.root.render()}
        </div>
      </div>
    );
  }
}

const getStyles = stylesFactory((theme: GrafanaTheme2) => ({
  wrap: css`
    overflow: hidden;
    position: relative;
  `,

  toolbar: css`
    position: absolute;
    bottom: 0;
    margin: 10px;
  `,
}));
