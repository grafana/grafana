import { css } from '@emotion/css';
import InfiniteViewer from 'infinite-viewer';
import Moveable from 'moveable';
import { CSSProperties } from 'react';
import { BehaviorSubject, ReplaySubject, Subject, Subscription } from 'rxjs';
import Selecto from 'selecto';

import { AppEvents, PanelData } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  ColorDimensionConfig,
  ResourceDimensionConfig,
  ScalarDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
  TooltipDisplayMode,
  DirectionDimensionConfig,
} from '@grafana/schema';
import { Portal } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions/context';
import {
  getColorDimensionFromData,
  getResourceDimensionFromData,
  getScalarDimensionFromData,
  getScaleDimensionFromData,
  getTextDimensionFromData,
  getDirectionDimensionFromData,
} from 'app/features/dimensions/utils';
import { CanvasContextMenu } from 'app/plugins/panel/canvas/components/CanvasContextMenu';
import { CanvasTooltip } from 'app/plugins/panel/canvas/components/CanvasTooltip';
import { Connections } from 'app/plugins/panel/canvas/components/connections/Connections';
import { Connections2 } from 'app/plugins/panel/canvas/components/connections/Connections2';
import { Options } from 'app/plugins/panel/canvas/panelcfg.gen';
import { AnchorPoint, CanvasTooltipPayload } from 'app/plugins/panel/canvas/types';

import appEvents from '../../../core/app_events';
import { CanvasPanel } from '../../../plugins/panel/canvas/CanvasPanel';
import { getDashboardSrv } from '../../dashboard/services/DashboardSrv';
import { CanvasFrameOptions } from '../frame';
import { DEFAULT_CANVAS_ELEMENT_CONFIG } from '../registry';

import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';
import { initMoveable, calculateZoomToFitScale } from './sceneAbleManagement';
import { findElementByTarget } from './sceneElementManagement';

export interface SelectionParams {
  targets: Array<HTMLElement | SVGElement>;
  frame?: FrameState;
}

export class Scene {
  styles = getStyles();
  readonly selection = new ReplaySubject<ElementState[]>(1);
  readonly moved = new Subject<number>(); // called after resize/drag for editor updates
  readonly byName = new Map<string, ElementState>();

  root: RootElement;

  revId = 0;

  width = 0;
  height = 0;
  scale = 1;
  scrollLeft = 0;
  scrollTop = 0;
  style: CSSProperties = {};
  data?: PanelData;
  selecto?: Selecto;
  moveable?: Moveable;
  infiniteViewer?: InfiniteViewer;
  div?: HTMLDivElement;
  viewerDiv?: HTMLDivElement;
  viewportDiv?: HTMLDivElement;
  connections: Connections | Connections2;
  currentLayer?: FrameState;
  isEditingEnabled?: boolean;
  shouldShowAdvancedTypes?: boolean;
  shouldPanZoom?: boolean;
  zoomToContent?: boolean;
  tooltipMode?: TooltipDisplayMode;
  skipNextSelectionBroadcast = false;
  ignoreDataUpdate = false;
  panel: CanvasPanel;
  contextMenuVisible?: boolean;
  openContextMenu?: (position: AnchorPoint) => void;
  contextMenuOnVisibilityChange = (visible: boolean) => {
    this.contextMenuVisible = visible;
  };

  isPanelEditing = locationService.getSearchObject().editPanel !== undefined;

  inlineEditingCallback?: () => void;
  setBackgroundCallback?: (anchorPoint: AnchorPoint) => void;

  tooltipCallback?: (tooltip: CanvasTooltipPayload | undefined) => void;
  tooltipPayload?: CanvasTooltipPayload;

  moveableActionCallback?: (moved: boolean) => void;

  actionConfirmationCallback?: () => void;

  readonly editModeEnabled = new BehaviorSubject<boolean>(false);
  subscription: Subscription;

  targetsToSelect = new Set<HTMLDivElement>();

  constructor(
    options: Options,
    public onSave: (cfg: CanvasFrameOptions) => void,
    panel: CanvasPanel
  ) {
    // TODO: Will need to update this approach for dashboard scenes
    // migration (new dashboard edit experience)
    const dashboard = getDashboardSrv().getCurrent();
    const enableEditing = options.inlineEditing && dashboard?.editable;

    this.root = this.load(options, enableEditing);

    this.subscription = this.editModeEnabled.subscribe((open) => {
      if (!this.moveable || !this.isEditingEnabled) {
        return;
      }
      this.moveable.draggable = !open;
    });

    this.panel = panel;
    this.connections = config.featureToggles.canvasPanelPanZoom ? new Connections2(this) : new Connections(this);
  }

  getNextElementName = (isFrame = false) => {
    const label = isFrame ? 'Frame' : 'Element';
    let idx = this.byName.size + 1;

    const max = idx + 100;
    while (true && idx < max) {
      const name = `${label} ${idx++}`;
      if (!this.byName.has(name)) {
        return name;
      }
    }

    return `${label} ${Date.now()}`;
  };

  canRename = (v: string) => {
    return !this.byName.has(v);
  };

  load(options: Options, enableEditing: boolean) {
    const { root, showAdvancedTypes, panZoom, zoomToContent, tooltip } = options;
    const tooltipMode = tooltip?.mode ?? TooltipDisplayMode.Single;

    this.root = new RootElement(
      root ?? {
        type: 'frame',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      },
      this,
      this.save // callback when changes are made
    );

    this.isEditingEnabled = enableEditing;
    this.shouldShowAdvancedTypes = showAdvancedTypes;
    this.shouldPanZoom = panZoom;
    this.zoomToContent = zoomToContent;
    this.tooltipMode = tooltipMode;

    setTimeout(() => {
      if (config.featureToggles.canvasPanelPanZoom) {
        if (this.viewportDiv && this.viewerDiv) {
          if (!this.shouldPanZoom) {
            this.scale = 1;
            this.scrollLeft = 0;
            this.scrollTop = 0;
          }

          // If editing is enabled, clear selecto instance
          const destroySelecto = enableEditing;
          initMoveable(destroySelecto, enableEditing, this);
          this.currentLayer = this.root;
          this.selection.next([]);
          this.connections.select(undefined);
          this.connections.updateState();
          // update initial connections svg size
          this.updateConnectionsSize();
          this.fitContent(this, zoomToContent);
        }
      } else {
        if (this.div) {
          // If editing is enabled, clear selecto instance
          const destroySelecto = enableEditing;
          initMoveable(destroySelecto, enableEditing, this);
          this.currentLayer = this.root;
          this.selection.next([]);
          this.connections.select(undefined);
          this.connections.updateState();
        }
      }
    });
    return this.root;
  }

  context: DimensionContext = {
    getColor: (color: ColorDimensionConfig) => getColorDimensionFromData(this.data, color),
    getScale: (scale: ScaleDimensionConfig) => getScaleDimensionFromData(this.data, scale),
    getScalar: (scalar: ScalarDimensionConfig) => getScalarDimensionFromData(this.data, scalar),
    getText: (text: TextDimensionConfig) => getTextDimensionFromData(this.data, text),
    getResource: (res: ResourceDimensionConfig) => getResourceDimensionFromData(this.data, res),
    getDirection: (direction: DirectionDimensionConfig) => getDirectionDimensionFromData(this.data, direction),
    getPanelData: () => this.data,
  };

  updateData(data: PanelData) {
    this.data = data;
    this.root.updateData(this.context);
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.style = { width, height };

    if (this.selecto?.getSelectedTargets().length) {
      this.clearCurrentSelection();
    }

    if (config.featureToggles.canvasPanelPanZoom) {
      this.updateConnectionsSize();
      this.fitContent(this, this.zoomToContent!);

      // TODO: This is a workaround to apply styles to the elements after the size update.
      // It's a good to go approach used by movable creator, but maybe we can find a better way.
      this.root.elements.forEach((el) => {
        el.applyLayoutStylesToDiv(false);
      });
      // TODO: This is a workaround to apply styles to the elements after the size update.
      // Remove this after dealing with the connection anchors stacking context issue.
      if (this.connections.connectionAnchorDiv) {
        this.connections.connectionAnchorDiv.style.display = 'none';
      }
    }
  }

  updateConnectionsSize() {
    const svgConnections = this.connections.connectionsSVG;

    if (svgConnections) {
      const scale = this.infiniteViewer!.getZoom();
      // NOTE: sometimes getScrollLeft and getScrollTop return NaN,
      // so we use || 0 to ensure we have a valid number
      const left = this.infiniteViewer!.getScrollLeft() || 0;
      const top = this.infiniteViewer!.getScrollTop() || 0;
      const width = this.width;
      const height = this.height;

      svgConnections.style.left = `${left}px`;
      svgConnections.style.top = `${top}px`;
      svgConnections.style.width = `${width / scale}px`;
      svgConnections.style.height = `${height / scale}px`;

      svgConnections.setAttribute('viewBox', `${left} ${top} ${width / scale} ${height / scale}`);
    }
  }

  clearCurrentSelection(skipNextSelectionBroadcast = false) {
    this.skipNextSelectionBroadcast = skipNextSelectionBroadcast;
    let event: MouseEvent = new MouseEvent('click');
    if (config.featureToggles.canvasPanelPanZoom) {
      this.selecto?.clickTarget(event, this.viewportDiv);
    } else {
      this.selecto?.clickTarget(event, this.div);
    }
  }

  save = (updateMoveable = false) => {
    this.onSave(this.root.getSaveModel());

    if (updateMoveable) {
      setTimeout(() => {
        if (config.featureToggles.canvasPanelPanZoom) {
          if (this.viewportDiv && this.viewerDiv) {
            initMoveable(true, this.isEditingEnabled, this);
            this.updateConnectionsSize();
          }
        } else {
          if (this.div) {
            initMoveable(true, this.isEditingEnabled, this);
          }
        }
      });
    }
  };

  setNonTargetPointerEvents = (target: Element, disablePointerEvents: boolean) => {
    const stack = [...this.root.elements];
    while (stack.length > 0) {
      const currentElement = stack.shift();

      if (currentElement && currentElement.div && currentElement.div !== target) {
        currentElement.applyLayoutStylesToDiv(disablePointerEvents);
      }

      const nestedElements = currentElement instanceof FrameState ? currentElement.elements : [];
      for (const nestedElement of nestedElements) {
        stack.unshift(nestedElement);
      }
    }
  };

  setRef = (sceneContainer: HTMLDivElement) => {
    this.div = sceneContainer;
  };

  setViewerRef = (viewerContainer: HTMLDivElement) => {
    this.viewerDiv = viewerContainer;
  };

  setViewportRef = (viewportContainer: HTMLDivElement) => {
    this.viewportDiv = viewportContainer;
  };

  select = (selection: SelectionParams) => {
    if (this.selecto) {
      this.selecto.setSelectedTargets(selection.targets);
      this.updateSelection(selection);
      this.editModeEnabled.next(false);

      // Hide connection anchors on programmatic select
      if (this.connections.connectionAnchorDiv) {
        this.connections.connectionAnchorDiv.style.display = 'none';
      }
    }
  };

  updateSelection = (selection: SelectionParams) => {
    this.moveable!.target = selection.targets;
    if (this.skipNextSelectionBroadcast) {
      this.skipNextSelectionBroadcast = false;
      return;
    }

    if (selection.frame) {
      this.selection.next([selection.frame]);
    } else {
      const s = selection.targets.map((t) => findElementByTarget(t, this.root.elements)!);
      this.selection.next(s);
    }
  };

  addToSelection = () => {
    try {
      let selection: SelectionParams = { targets: [] };
      selection.targets = [...this.targetsToSelect];
      this.select(selection);
    } catch (error) {
      appEvents.emit(AppEvents.alertError, ['Unable to add to selection']);
    }
  };

  fitContent = (scene: Scene, zoomToContent: boolean) => {
    const { root, viewerDiv, infiniteViewer } = scene;
    if (zoomToContent && root.div && infiniteViewer && viewerDiv) {
      const dimentions = calculateZoomToFitScale(Array.from(root.div.children), viewerDiv);
      const { scale, centerX, centerY } = dimentions;
      infiniteViewer.setZoom(scale);
      infiniteViewer.scrollTo(centerX, centerY);
    }
  };

  render() {
    const hasDataLinks = this.tooltipPayload?.element?.getLinks && this.tooltipPayload.element.getLinks({}).length > 0;
    const hasActions =
      this.tooltipPayload?.element?.options.actions && this.tooltipPayload.element.options.actions.length > 0;

    const isTooltipValid = hasDataLinks || hasActions || this.tooltipPayload?.element?.data?.field;
    const isTooltipEnabled = this.tooltipMode !== TooltipDisplayMode.None;
    const canShowElementTooltip = !this.isEditingEnabled && isTooltipValid && isTooltipEnabled;

    const sceneDiv = (
      <>
        {this.connections.render()}
        {this.root.render()}
        {this.isEditingEnabled && (
          <Portal>
            <CanvasContextMenu
              scene={this}
              panel={this.panel}
              onVisibilityChange={this.contextMenuOnVisibilityChange}
            />
          </Portal>
        )}
        {canShowElementTooltip && (
          <Portal>
            <CanvasTooltip scene={this} />
          </Portal>
        )}
      </>
    );

    return config.featureToggles.canvasPanelPanZoom ? (
      <div className={this.styles.viewer} ref={this.setViewerRef} key={this.revId} data-testid="canvas-scene-wrapper">
        <div
          className={this.styles.viewport}
          ref={this.setViewportRef}
          key={this.revId}
          data-testid="canvas-scene-pan-zoom"
        >
          {sceneDiv}
        </div>
      </div>
    ) : (
      <div
        key={this.revId}
        className={this.styles.wrap}
        style={this.style}
        ref={this.setRef}
        data-testid="canvas-scene"
      >
        {sceneDiv}
      </div>
    );
  }
}

const getStyles = () => ({
  wrap: css({
    overflow: 'hidden',
    position: 'relative',
  }),
  selected: css({
    zIndex: '999 !important',
  }),
  viewer: css({
    overflow: 'hidden',
    width: '100%',
    height: '100%',
  }),
  viewport: css({
    width: '100%',
    height: '100%',
  }),
});
