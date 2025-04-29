import { css } from '@emotion/css';
import InfiniteViewer from 'infinite-viewer';
import Moveable from 'moveable';
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
} from '@grafana/schema';
import { Portal } from '@grafana/ui';
import { config } from 'app/core/config';
import { DimensionContext } from 'app/features/dimensions';
import {
  getColorDimensionFromData,
  getResourceDimensionFromData,
  getScalarDimensionFromData,
  getScaleDimensionFromData,
  getTextDimensionFromData,
} from 'app/features/dimensions/utils';
import { CanvasContextMenu } from 'app/plugins/panel/canvas/components/CanvasContextMenu';
import { CanvasTooltip } from 'app/plugins/panel/canvas/components/CanvasTooltip';
// import { CONNECTION_ANCHOR_DIV_ID } from 'app/plugins/panel/canvas/components/connections/ConnectionAnchors';
import {
  Connections,
  // CONNECTION_VERTEX_ADD_ID,
  // CONNECTION_VERTEX_ID,
} from 'app/plugins/panel/canvas/components/connections/Connections';
import { AnchorPoint, CanvasTooltipPayload } from 'app/plugins/panel/canvas/types';
import { getTransformInstance } from 'app/plugins/panel/canvas/utils';

import appEvents from '../../../core/app_events';
import { CanvasPanel } from '../../../plugins/panel/canvas/CanvasPanel';
import { CanvasFrameOptions } from '../frame';
import { DEFAULT_CANVAS_ELEMENT_CONFIG } from '../registry';

// import { SceneTransformWrapper } from './SceneTransformWrapper';
// import { constraintViewable, dimensionViewable, settingsViewable } from './ables';
import { ElementState } from './element';
import { FrameState } from './frame';
import { RootElement } from './root';
import { initMoveable } from './sceneAbleManagement';
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
  // style doesn't seem to be used anywhere
  // style: CSSProperties = {};
  data?: PanelData;
  selecto?: Selecto;
  moveable?: Moveable;
  infiniteViewer?: InfiniteViewer;
  // div?: HTMLDivElement;
  viewerDiv?: HTMLDivElement;
  viewportDiv?: HTMLDivElement;
  connections: Connections;
  currentLayer?: FrameState;
  isEditingEnabled?: boolean;
  shouldShowAdvancedTypes?: boolean;
  shouldPanZoom?: boolean;
  shouldInfinitePan?: boolean;
  skipNextSelectionBroadcast = false;
  ignoreDataUpdate = false;
  panel: CanvasPanel;
  contextMenuVisible?: boolean;
  openContextMenu?: (position: AnchorPoint) => void;
  contextMenuOnVisibilityChange = (visible: boolean) => {
    this.contextMenuVisible = visible;
    const transformInstance = getTransformInstance(this);
    if (transformInstance) {
      if (visible) {
        // transformInstance.setup.disabled = true;
      } else {
        // transformInstance.setup.disabled = false;
      }
    }
  };

  isPanelEditing = locationService.getSearchObject().editPanel !== undefined;

  inlineEditingCallback?: () => void;
  setBackgroundCallback?: (anchorPoint: AnchorPoint) => void;

  tooltipCallback?: (tooltip: CanvasTooltipPayload | undefined) => void;
  tooltip?: CanvasTooltipPayload;

  moveableActionCallback?: (moved: boolean) => void;

  actionConfirmationCallback?: () => void;

  readonly editModeEnabled = new BehaviorSubject<boolean>(false);
  subscription: Subscription;

  targetsToSelect = new Set<HTMLDivElement>();
  // transformComponentRef: RefObject<ReactZoomPanPinchContentRef> | undefined;

  constructor(
    cfg: CanvasFrameOptions,
    enableEditing: boolean,
    showAdvancedTypes: boolean,
    panZoom: boolean,
    infinitePan: boolean,
    public onSave: (cfg: CanvasFrameOptions) => void,
    panel: CanvasPanel
  ) {
    this.root = this.load(cfg, enableEditing, showAdvancedTypes, panZoom, infinitePan);

    this.subscription = this.editModeEnabled.subscribe((open) => {
      if (!this.moveable || !this.isEditingEnabled) {
        return;
      }
      this.moveable.draggable = !open;
    });

    this.panel = panel;
    this.connections = new Connections(this);
    // this.transformComponentRef = createRef();
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

  load(
    cfg: CanvasFrameOptions,
    enableEditing: boolean,
    showAdvancedTypes: boolean,
    panZoom: boolean,
    infinitePan: boolean
  ) {
    this.root = new RootElement(
      cfg ?? {
        type: 'frame',
        elements: [DEFAULT_CANVAS_ELEMENT_CONFIG],
      },
      this,
      this.save // callback when changes are made
    );

    this.isEditingEnabled = enableEditing;
    this.shouldShowAdvancedTypes = showAdvancedTypes;
    this.shouldPanZoom = panZoom;
    this.shouldInfinitePan = infinitePan;

    setTimeout(() => {
      // if (this.div) {
      if (this.viewportDiv) {
        // If editing is enabled, clear selecto instance
        const destroySelecto = enableEditing;
        initMoveable(destroySelecto, enableEditing, this);
        this.currentLayer = this.root;
        this.selection.next([]);
        this.connections.select(undefined);
        this.connections.updateState();
        // update initial connections svg size
        this.updateConnectionsSize();
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
    getPanelData: () => this.data,
  };

  updateData(data: PanelData) {
    this.data = data;
    this.root.updateData(this.context);
  }

  updateSize(width: number, height: number) {
    this.width = width;
    this.height = height;
    // this.style doesn't seem to be used anywhere
    // this.style = { width, height };

    if (this.selecto?.getSelectedTargets().length) {
      this.clearCurrentSelection();
    }

    this.updateConnectionsSize();
  }

  updateConnectionsSize() {
    const svgConnections = this.connections.connectionsSVG;

    if (svgConnections) {
      const scale = this.infiniteViewer!.getZoom();
      const left = this.infiniteViewer!.getScrollLeft();
      const top = this.infiniteViewer!.getScrollTop();
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
    // this.selecto?.clickTarget(event, this.div);
    this.selecto?.clickTarget(event, this.viewportDiv);
  }

  save = (updateMoveable = false) => {
    this.onSave(this.root.getSaveModel());

    if (updateMoveable) {
      setTimeout(() => {
        // if (this.div) {
        if (this.viewportDiv) {
          initMoveable(true, this.isEditingEnabled, this);
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

  // setRef = (sceneContainer: HTMLDivElement) => {
  //   this.div = sceneContainer;
  // };

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

  render() {
    const hasDataLinks = this.tooltip?.element?.getLinks && this.tooltip.element.getLinks({}).length > 0;
    const hasActions = this.tooltip?.element?.options.actions && this.tooltip.element.options.actions.length > 0;

    const isTooltipValid = hasDataLinks || hasActions || this.tooltip?.element?.data?.field;
    const canShowElementTooltip = !this.isEditingEnabled && isTooltipValid;

    const sceneDiv = (
      <>
        {/* <div key={this.revId} className={this.styles.wrap} style={this.style} ref={this.setRef}> */}
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
        {/* </div> */}
      </>
    );

    // return (
    //   <InfiniteViewer
    //     className="viewer"
    //     margin={0}
    //     threshold={0}
    //     rangeX={[0, 0]}
    //     rangeY={[0, 0]}
    //     onScroll={e => {
    //     }}
    //   >
    //     <div className="viewport">
    //       {sceneDiv}
    //     </div>
    //   </InfiniteViewer>
    // )

    return config.featureToggles.canvasPanelPanZoom ? (
      <>
        {/* <SceneTransformWrapper scene={this}>{sceneDiv}</SceneTransformWrapper> */}
        <div className={this.styles.viewer} ref={this.setViewerRef}>
          <div className={this.styles.viewport} ref={this.setViewportRef} key={this.revId}>
            {sceneDiv}
          </div>
        </div>
      </>
    ) : (
      sceneDiv
    );
  }
}

const getStyles = () => ({
  wrap: css({
    overflow: 'hidden',
    position: 'relative',
    // border: `2px solid green`,
  }),
  selected: css({
    zIndex: '999 !important',
  }),
  viewer: css({
    width: '100%',
    height: '100%',
  }),
  viewport: css({
    // overflow: 'hidden',
    // position: 'relative',
  }),
});
