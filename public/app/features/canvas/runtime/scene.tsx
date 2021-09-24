import React, { CSSProperties } from 'react';
import { css } from '@emotion/css';
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
import { ReplaySubject } from 'rxjs';
import { GroupState } from './group';
import { ElementState } from './element';

export class Scene {
  private root: GroupState;
  private lookup = new Map<number, ElementState>();
  private selectedX = new ReplaySubject<ElementState | undefined>(undefined);
  private selectedUID = 0; // nothing selected

  styles = getStyles(config.theme2);

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
    let first: ElementState | undefined = undefined;
    this.lookup.clear();
    this.root.visit((v) => {
      this.lookup.set(v.UID, v);

      // HACK! select the first/only item
      if (!first && v.item.id !== 'group') {
        first = v;
        this.selectItem(v.UID);
      }
    });
    if (!first) {
      this.selectItem(-1);
    }
    return this.root;
  }

  context: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.data, scale),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.data, res),
  };

  getElement(uid: number) {
    return this.lookup.get(uid);
  }

  getSelectedItem() {
    return this.lookup.get(this.selectedUID);
  }

  getSelected() {
    return this.selectedX.asObservable();
  }

  selectItem(uid?: number) {
    this.selectedUID = uid ?? -1;
    this.selectedX.next(this.getSelectedItem());
  }

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
    console.log('SCENE ELEMENT CHANGED', uid, elem.revId, cfg);
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
