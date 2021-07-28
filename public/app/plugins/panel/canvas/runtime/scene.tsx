import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
import { config } from 'app/core/config';
import { GrafanaTheme2, PanelData } from '@grafana/data';
import { stylesFactory } from '@grafana/ui';
import { CanvasElementItem, CanvasElementOptions, CanvasGroupOptions } from '../base';
import { notFoundItem } from '../elements/notFound';
import { canvasElementRegistry, DEFAULT_ELEMENT_CONFIG } from '../elements/registry';
import { ReplaySubject } from 'rxjs';

let counter = 100;

export class ElementState {
  readonly UID = counter++;

  revId = 0;
  style: CSSProperties;

  constructor(public item: CanvasElementItem, public options: CanvasElementOptions, public parent?: GroupState) {
    if (!options) {
      this.options = { type: item.id };
    }

    this.style = this.getBaseStyle();
  }

  getBaseStyle(): CSSProperties {
    const css: CSSProperties = {};

    const { background, border } = this.options;

    if (border && border.width) {
      css.borderWidth = border.width;
      css.borderColor = '#F00';
    }

    if (background) {
      css.backgroundColor = '#FF0';

      if (background.image) {
        css.backgroundImage = 'url(public/plugins/edge-draw-panel/img/' + background.image + ')';
        css.backgroundRepeat = 'no-repeat';
        css.backgroundSize = '100% 100%';
      }
    }

    return css;
  }

  // ???Given the configuraiton, what fields should exist in the update
  getRequiredFields(): string[] {
    return [];
  }

  /** Recursivly visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    visitor(this);
  }

  // Something changed
  onChange(options: CanvasElementOptions) {
    this.revId++;
    this.options = { ...options };
    this.style = this.getBaseStyle();
    let trav = this.parent;
    while (trav) {
      trav.revId++;
      trav = trav.parent;
    }
  }

  getSaveModel() {
    return { ...this.options };
  }

  render(data: PanelData) {
    const { item } = this;
    return (
      <div key={`${this.UID}/${this.revId}`} style={this.style}>
        <item.display config={this.options.config} data={data} />
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

  render(data: PanelData) {
    return (
      <div key={`${this.UID}/${this.revId}`} style={this.style}>
        {this.elements.map((v) => v.render(data))}
      </div>
    );
  }

  /** Recursivly visit all nodes */
  visit(visitor: (v: ElementState) => void) {
    visitor(this);
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

  updateData(data: PanelData) {
    console.log('Data changed', data);
  }

  updateSize(width: number, height: number) {
    console.log('SIZE changed', width, height);
  }

  onChange(uid: number, cfg: CanvasElementOptions) {
    const elem = this.lookup.get(uid);
    if (!elem) {
      throw new Error('element not found: ' + uid + ' // ' + this.lookup.keys());
    }
    this.revId++;
    elem.onChange(cfg);
    this.save();
  }

  save() {
    this.onSave(this.root.getSaveModel());
  }

  render(data: PanelData) {
    return (
      <div key={this.revId} className={this.styles.wrap}>
        {this.root.render(data)}
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
    width: 100%;
    height: 100%;
    overflow: hidden;
    position: relative;
  `,

  toolbar: css`
    position: absolute;
    bottom: 0;
    margin: 10px;
  `,
}));
