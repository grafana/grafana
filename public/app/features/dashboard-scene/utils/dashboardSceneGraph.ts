import { config } from '@grafana/runtime';
import { VizPanel, sceneGraph, behaviors, SceneObject, SceneGridRow } from '@grafana/scenes';
import { DashboardLocale, initializeDashboardLocale } from 'app/features/bmc-content-localization/types';
import { getFeatureStatus } from 'app/features/dashboard/services/featureFlagSrv';

import { DashboardDataLayerSet } from '../scene/DashboardDataLayerSet';
import { DashboardScene } from '../scene/DashboardScene';
import { VizPanelLinks } from '../scene/PanelLinks';
import { DashboardGridItem } from '../scene/layout-default/DashboardGridItem';

import { isClonedKey } from './clone';
import { getDashboardSceneFor, getLayoutManagerFor, getPanelIdForVizPanel, getVizPanelKeyForPanelId } from './utils';

function getTimePicker(scene: DashboardScene) {
  return scene.state.controls?.state.timePicker;
}

function getRefreshPicker(scene: DashboardScene) {
  return scene.state.controls?.state.refreshPicker;
}

function getPanelLinks(panel: VizPanel) {
  if (panel.state.titleItems && Array.isArray(panel.state.titleItems)) {
    // search panel.state.titleItems for VizPanelLinks
    const panelLink = panel.state.titleItems.find((item) => item instanceof VizPanelLinks);
    return panelLink ?? null;
  }

  return null;
}

function getVizPanels(scene: DashboardScene): VizPanel[] {
  return scene.state.body.getVizPanels();
}

/**
 * Will look for all panels in the entire scene starting from root
 * and find the next free panel id
 */
export function getNextPanelId(scene: SceneObject): number {
  let max = 0;

  sceneGraph
    .findAllObjects(scene.getRoot(), (obj) => obj instanceof VizPanel || obj instanceof SceneGridRow)
    .forEach((panel) => {
      if (isClonedKey(panel.state.key!)) {
        return;
      }

      const panelId = getPanelIdForVizPanel(panel);
      if (panelId > max) {
        max = panelId;
      }
    });

  return max + 1;
}

function getDataLayers(scene: DashboardScene): DashboardDataLayerSet {
  const data = sceneGraph.getData(scene);

  if (!(data instanceof DashboardDataLayerSet)) {
    throw new Error('DashboardDataLayerSet not found');
  }

  return data;
}

function getAllSelectedObjects(scene: SceneObject): SceneObject[] {
  return (
    getDashboardSceneFor(scene)
      .state.editPane.state.selection?.getSelectionEntries()
      .map(([, ref]) => ref.resolve()) ?? []
  );
}

export function getCursorSync(scene: DashboardScene) {
  const cursorSync = scene.state.$behaviors?.find((b) => b instanceof behaviors.CursorSync);

  if (cursorSync instanceof behaviors.CursorSync) {
    return cursorSync;
  }

  return;
}
// Functions to manage the lookup table in dashboard scene that will hold element_identifer : panel_id
export function getElementIdentifierForVizPanel(vizPanel: VizPanel): string {
  const scene = getDashboardSceneFor(vizPanel);
  const panelId = getPanelIdForVizPanel(vizPanel);
  let elementKey = scene.getElementIdentifierForPanel(panelId);

  if (!elementKey) {
    // assign a panel-id key
    elementKey = getVizPanelKeyForPanelId(panelId);
  }
  return elementKey;
}

// BMC Change: Starts
// BMC Code: Utility function to localize content
// This function replaces all instances of {{key}} in the content with the corresponding value from the locales object
// If the key is not found in the locales object, it is left as-is
// The function is recursive, so it can handle nested objects and arrays
export function replaceValuesRecursive(content: any, locales: { [key: string]: any }): { [key: string]: any } {
  if (!getFeatureStatus('bhd-localization')) {
    return content;
  }
  // If content is an array, process each element recursively
  if (Array.isArray(content)) {
    for (let i = 0; i < content.length; i++) {
      content[i] = replaceValuesRecursive(content[i], locales);
    }
    return content;
  }
  // If content is an object, process its properties
  else if (typeof content === 'object' && content !== null) {
    for (const key in content) {
      if (Object.hasOwn(content, key)) {
        const value = content[key];

        // If the value is a string, check if it exists as a key in locales
        if (typeof value === 'string') {
          content[key] = replaceValueForLocale(value, locales);
        }
        // If the value is an object or an array, recurse into it
        else if (typeof value === 'object') {
          content[key] = replaceValuesRecursive(value, locales);
        }
      }
    }
    return content;
  }

  // If content is neither an object nor an array, return it as-is
  return content;
}

const localeKeyRegExp = /{{(\w+)}}/g;
export function replaceValueForLocale(str: string, locales: { [key: string]: any }): string {
  if (!getFeatureStatus('bhd-localization')) {
    return str;
  }
  return str.replace(localeKeyRegExp, (match, varName) => {
    const v = `${varName}`;
    if (locales.hasOwnProperty(v)) {
      return locales[v];
    }
    return match;
  });
}

export function updateCurrentLocales(locales: DashboardLocale): { currentLocales: DashboardLocale } {
  let currentLocales: DashboardLocale = initializeDashboardLocale();
  if (!!locales) {
    const userLang = config.bootData.user.language ?? 'default';
    const selectLocales = locales[userLang as keyof DashboardLocale] ?? {};
    const reducedLocaleObj = Object.keys(selectLocales).reduce((acc: any, cur: string) => {
      if (selectLocales[cur]) {
        acc[cur] = selectLocales[cur];
      }
      return acc;
    }, {});
    let globalLocales = {};
    try {
      const gL = localStorage.getItem('globalLocales');
      if (gL) {
        globalLocales = JSON.parse(gL);
      }
    } catch (e) {}
    currentLocales = { ...globalLocales, ...locales['default'], ...reducedLocaleObj };
  }
  return { currentLocales };
}

export function getRecordDetailsHeightMap(): { [key: string]: number } {
  const recordDetailsPanelHeightMap: { [key: string]: number } = {};
  const layout = document.querySelector<HTMLElement>('.react-grid-layout') ?? false;
  if (layout) {
    const items = document.querySelectorAll('.react-grid-item');
    if (items.length > 0) {
      items.forEach((gridItem) => {
        const panelItems = Array.from(gridItem.children[0].children);
        panelItems.forEach((panelItem) => {
          const vizPanel = (panelItem as HTMLElement)?.['dataset']?.['vizPanelKey']
            ? panelItem
            : panelItem.querySelector('[data-viz-panel-key]');
          const recordDetailsPluginPanel = panelItem.querySelector('.responsive_record_details');
          let panelContent = panelItem.querySelector('[class^="css-"][class$="-panel-content"]');

          if (recordDetailsPluginPanel && panelContent && panelContent.firstChild && vizPanel) {
            const firstChild = panelContent.firstChild as Element;
            // Grafana row 1 = 37px
            const panelAddHeight = Math.ceil((firstChild['scrollHeight'] - firstChild['clientHeight']) / 37);
            const vizPanelKey = (vizPanel as HTMLElement).dataset?.['vizPanelKey'];
            if (vizPanelKey) {
              recordDetailsPanelHeightMap[vizPanelKey] = panelAddHeight;
            }
          }
        });
      });
    }
  }
  return recordDetailsPanelHeightMap;
}

export function getDeflatedLayoutChildren(item: SceneObject, index: number, heightMap: { [key: string]: number }) {
  if (item instanceof SceneGridRow) {
    const sceneGridChildren: SceneObject[] = [];
    item.state.children.map((childItem, childIndex) => {
      Array.prototype.push.apply(sceneGridChildren, getDeflatedLayoutChildren(childItem, childIndex, heightMap));
    });
    item.setState({ children: sceneGridChildren });
    return [item];
  } else if (
    item instanceof DashboardGridItem &&
    item.state.repeatedPanels?.length &&
    item.state.body?.state.pluginId === 'bmc-record-details'
  ) {
    const tmpArr = [];
    const maxPerRow = Math.min(item.state.repeatedPanels?.length, item.state.maxPerRow ?? 0);
    for (let i = 0; i < item.state.repeatedPanels?.length; i++) {
      const tmpItem = item.clone() as DashboardGridItem;
      let width = tmpItem.state.width,
        height = tmpItem.state.height,
        x = 0;
      if (tmpItem.state.repeatDirection === 'v') {
        width = 24;
        height = tmpItem.state.itemHeight;
      } else {
        width = width = 24 / maxPerRow;
        height = tmpItem.state.itemHeight;
        x = (i % maxPerRow) * width;
      }
      tmpItem.setState({
        x,
        key: `${tmpItem.state.key}-${tmpItem.state.repeatedPanels![i].state.key}`,
        width,
        height: (height ?? 0) + (heightMap[tmpItem.state.repeatedPanels![i].state.key!] ?? 0),
        repeatedPanels: undefined,
        repeatDirection: undefined,
        body: tmpItem.state.repeatedPanels![i],
        variableName: undefined,
      });
      tmpItem.activate();
      tmpArr.push(tmpItem);
      delete heightMap[item.state.repeatedPanels[i].state.key!];
    }
    return tmpArr;
  } else {
    if (item instanceof DashboardGridItem && item.state.body?.state.pluginId === 'bmc-record-details') {
      const additionalHeight = heightMap[item.state.body.state.key!] ?? 0;
      item.setState({
        height: (item.state.height ?? 0) + additionalHeight,
      });
      delete heightMap[item.state.body.state.key!];
    }
    return [item];
  }
}
// BMC Change: Ends

export const dashboardSceneGraph = {
  getTimePicker,
  getRefreshPicker,
  getPanelLinks,
  getVizPanels,
  getDataLayers,
  getAllSelectedObjects,
  getCursorSync,
  getLayoutManagerFor,
  getNextPanelId,
  getElementIdentifierForVizPanel,
  // BMC Change: Below exported methods
  replaceValuesRecursive,
  replaceValueForLocale,
  updateCurrentLocales,
  getRecordDetailsHeightMap,
  getDeflatedLayoutChildren,
};
