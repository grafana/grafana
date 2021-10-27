import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
import { ReplaySubject, Subject } from 'rxjs';
import Moveable from 'moveable';
import Selecto from 'selecto';

import { config } from 'app/core/config';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import {
  Anchor,
  CanvasElementOptions,
  CanvasGroupOptions,
  DEFAULT_CANVAS_ELEMENT_CONFIG,
  Placement,
} from 'app/features/canvas';
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
import { ElementState } from './element';
import { RootElement } from './root';

export class Scene {
  private lookup = new Map<number, ElementState>();
  styles = getStyles(config.theme2);
  readonly selection = new ReplaySubject<ElementState[]>(1);
  readonly moved = new Subject<number>(); // called after resize/drag for editor updates
  root: RootElement;

  revId = 0;

  width = 0;
  height = 0;
  style: CSSProperties = {};
  data?: PanelData;
  selecto?: Selecto;
  div?: HTMLDivElement;

  constructor(cfg: CanvasGroupOptions, enableEditing: boolean, public onSave: (cfg: CanvasGroupOptions) => void) {
    this.root = this.load(cfg, enableEditing);
  }

  load(cfg: CanvasGroupOptions, enableEditing: boolean) {
    this.root = new RootElement(
      cfg ?? {
        type: 'group',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      },
      this.save // callback when changes are made
    );

    // Build the scene registry
    this.lookup.clear();
    this.root.visit((v) => {
      this.lookup.set(v.UID, v);
    });

    setTimeout(() => {
      if (this.div && enableEditing) {
        this.initMoveable();
      }
    }, 100);
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

    if (this.selecto?.getSelectedTargets().length) {
      let event: MouseEvent = new MouseEvent('click');
      this.selecto.clickTarget(event, this.div);
    }
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

  toggleAnchor(element: ElementState, k: keyof Anchor) {
    console.log('TODO, smarter toggle', element.UID, element.anchor, k);
    const { div } = element;
    if (!div) {
      console.log('Not ready');
      return;
    }

    const w = element.parent?.width ?? 100;
    const h = element.parent?.height ?? 100;

    // Get computed position....
    const info = div.getBoundingClientRect(); // getElementInfo(div, element.parent?.div);
    console.log('DIV info', div);

    const placement: Placement = {
      top: info.top,
      left: info.left,
      width: info.width,
      height: info.height,
      bottom: h - info.bottom,
      right: w - info.right,
    };

    console.log('PPP', placement);

    // // TODO: needs to recalculate placement based on absolute values...
    // element.anchor[k] = !Boolean(element.anchor[k]);
    // element.placement = placement;
    // element.validatePlacement();
    // element.revId++;
    // this.revId++;
    //    this.save();

    this.moved.next(Date.now());
  }

  save = () => {
    this.onSave(this.root.getSaveModel());
  };

  private findElementByTarget = (target: HTMLElement | SVGElement): ElementState | undefined => {
    return this.root.elements.find((element) => element.div === target);
  };

  setRef = (sceneContainer: HTMLDivElement) => {
    this.div = sceneContainer;
  };

  initMoveable = () => {
    const targetElements: HTMLDivElement[] = [];
    this.root.elements.forEach((element: ElementState) => {
      targetElements.push(element.div!);
    });

    this.selecto = new Selecto({
      container: this.div,
      selectableTargets: targetElements,
      selectByClick: true,
    });

    const moveable = new Moveable(this.div!, {
      draggable: true,
      resizable: true,
    })
      .on('clickGroup', (event) => {
        this.selecto!.clickTarget(event.inputEvent, event.inputTarget);
      })
      .on('drag', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyDrag(event);
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('dragGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyDrag(event);
        });
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resize', (event) => {
        const targetedElement = this.findElementByTarget(event.target);
        targetedElement!.applyResize(event);
        this.moved.next(Date.now()); // TODO only on end
      })
      .on('resizeGroup', (e) => {
        e.events.forEach((event) => {
          const targetedElement = this.findElementByTarget(event.target);
          targetedElement!.applyResize(event);
        });
        this.moved.next(Date.now()); // TODO only on end
      });

    let targets: Array<HTMLElement | SVGElement> = [];
    this.selecto!.on('dragStart', (event) => {
      const selectedTarget = event.inputEvent.target;

      const isTargetMoveableElement =
        moveable.isMoveableElement(selectedTarget) ||
        targets.some((target) => target === selectedTarget || target.contains(selectedTarget));

      if (isTargetMoveableElement) {
        // Prevent drawing selection box when selected target is a moveable element
        event.stop();
      }
    }).on('selectEnd', (event) => {
      targets = event.selected;
      moveable.target = targets;

      const s = event.selected.map((t) => this.findElementByTarget(t)!);
      this.selection.next(s);
      console.log('UPDATE selection', s);

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
      <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.setRef}>
        {this.root.render()}
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
