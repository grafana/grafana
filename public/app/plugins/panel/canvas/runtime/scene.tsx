import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { CanvasElementItem, CanvasElementOptions, CanvasGroupOptions, CanvasSceneContext } from '../base';
import { notFoundItem } from '../elements/notFound';
import { canvasElementRegistry, DEFAULT_ELEMENT_CONFIG } from '../elements/registry';
import { ReplaySubject } from 'rxjs';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getScaleDimensionFromData,
  getResourceDimensionFromData,
  getTextDimensionFromData,
} from './utils';

let counter = 100;

export class ElementState {
  readonly UID = counter++;

  revId = 0;
  style: CSSProperties = {};

  // Calculated
  width: number;
  height: number;
  data?: any; // depends on the type

  constructor(public item: CanvasElementItem, public options: CanvasElementOptions, public parent?: GroupState) {
    if (!options) {
      this.options = { type: item.id };
    }
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Update the CSS position
    this.style = {
      ...this.style,
      width,
      height,
    };
  }

  updateData(ctx: CanvasSceneContext) {
    if (this.item.prepareData) {
      this.data = this.item.prepareData(ctx, this.options.config);
      this.revId++; // rerender
    }

    const { background, border } = this.options;
    const css: CSSProperties = {};
    if (background && background.color) {
      const color = ctx.getColor(background.color);
      css.backgroundColor = color.value();

      // TODO?? configure/save background images!
      // if (background.image) {
      //   css.backgroundImage = 'url(public/plugins/edge-draw-panel/img/' + background.image + ')';
      //   css.backgroundRepeat = 'no-repeat';
      //   css.backgroundSize = '100% 100%';
      // }
    }

    if (border && border.color && border.width) {
      const color = ctx.getColor(border.color);
      // size?
      css.border = `${border.width}px solid ${color.value()}`;
      // css.borderWidth = border.width;
      // css.borderBlockStyle = 'solid';
      // css.borderColor = color.get(0);
    }

    css.width = this.width;
    css.height = this.height;

    this.style = css;
  }

  /** Recursivly visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    visitor(this);
  }

  // Something changed
  onChange(options: CanvasElementOptions) {
    if (this.item.id !== options.type) {
      this.item = canvasElementRegistry.getIfExists(options.type) ?? notFoundItem;
    }

    this.revId++;
    this.options = { ...options };
    let trav = this.parent;
    while (trav) {
      trav.revId++;
      trav = trav.parent;
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  render() {
    const { item } = this;
    return (
      <div key={`${this.UID}/${this.revId}`} style={this.style}>
        <item.display config={this.options.config} width={this.width} height={this.height} data={this.data} />
      </div>
    );
  }
}

export class GroupState extends ElementState {
  readonly elements: ElementState[] = [];

  constructor(public options: CanvasGroupOptions, public parent?: GroupState) {
    super(groupItemDummy, options, parent);

    // mutate options object
    let { elements } = this.options;
    if (!elements) {
      this.options.elements = elements = [];
    }

    for (const c of elements) {
      if (c.type === 'group') {
        this.elements.push(new GroupState(c as CanvasGroupOptions, this));
      } else {
        const item = canvasElementRegistry.getIfExists(c.type) ?? notFoundItem;
        this.elements.push(new ElementState(item, c, parent));
      }
    }
  }

  // The parent size, need to set our own size based on offsets
  updateSize(width: number, height: number) {
    super.updateSize(width, height);

    // Update children with calculated size
    for (const elem of this.elements) {
      elem.updateSize(this.width, this.height);
    }
  }

  updateData(ctx: CanvasSceneContext) {
    super.updateData(ctx);
    for (const elem of this.elements) {
      elem.updateData(ctx);
    }
  }

  render() {
    return (
      <div key={`${this.UID}/${this.revId}`} style={this.style}>
        {this.elements.map((v) => v.render())}
      </div>
    );
  }

  /** Recursivly visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    super.visit(visitor);
    for (const e of this.elements) {
      visitor(e);
    }
  }

  getSaveModel() {
    return {
      ...this.options,
      elements: this.elements.map((v) => v.getSaveModel()),
    };
  }
}

export class Scene {
  private root: GroupState;
  private lookup = new Map<number, ElementState>();
  styles = getStyles(config.theme2);
  readonly selected = new ReplaySubject<ElementState | undefined>(undefined);
  revId = 0;

  width = 0;
  height = 0;
  style: CSSProperties = {};
  data: PanelData;

  constructor(cfg: CanvasGroupOptions, public onSave: (cfg: CanvasGroupOptions) => void) {
    this.root = new GroupState(
      cfg ?? {
        type: 'group',
        elements: [DEFAULT_ELEMENT_CONFIG],
      }
    );

    // Build the scene registry
    this.root.visit((v) => {
      this.lookup.set(v.UID, v);

      // HACK! select the first/only item
      if (v.item.id !== 'group') {
        this.selected.next(v);
      }
    });
  }

  context: CanvasSceneContext = {
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

  render() {
    return (
      <div key={this.revId} className={this.styles.wrap} style={this.style}>
        {this.root.render()}
      </div>
    );
  }
}

export const groupItemDummy: CanvasElementItem = {
  id: 'group',
  name: 'Group',
  description: 'Group',

  // eslint-disable-next-line react/display-name
  display: () => {
    return <div>GROUP!</div>;
  },
};

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
