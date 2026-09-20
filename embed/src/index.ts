import { defineGrafanaPanel } from './element';

export { GrafanaPanelElement, defineGrafanaPanel, ELEMENT_NAME } from './element';
export { registerPanelType, registeredPanelTypes } from './panels/registry';
export {
  normalizePanel,
  type EmbedPanel,
  type EmbedPanelInput,
  type PanelKindInput,
  type PanelV1Input,
} from './panel/normalize';
export {
  panelDataFromFrames,
  staticDataProvider,
  type EmbedDataProvider,
  type EmbedDataRequest,
  type EmbedPanelData,
} from './data/types';
export { framesFromDataFrameJSON, framesFromQueryResponse, framesFromPromMatrix } from './data/decode';
export { installFonts } from './styles/shadowStyles';
export { dataFrameFromJSON, toDataFrame, FieldType, type DataFrame } from '@grafana/data';

// Importing the bundle registers the element. Hosts that want a different tag name
// can call defineGrafanaPanel('x-panel') before first use.
defineGrafanaPanel();
