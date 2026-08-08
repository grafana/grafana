import { buttonItem } from './elements/button';
import { cloudItem } from './elements/cloud';
import { droneFrontItem } from './elements/droneFront';
import { droneSideItem } from './elements/droneSide';
import { droneTopItem } from './elements/droneTop';
import { ellipseItem } from './elements/ellipse';
import { iconItem } from './elements/icon';
import { metricValueItem } from './elements/metricValue';
import { notFoundItem } from './elements/notFound';
import { parallelogramItem } from './elements/parallelogram';
import { rectangleItem } from './elements/rectangle';
import { serverItem } from './elements/server/server';
import { textItem } from './elements/text';
import { triangleItem } from './elements/triangle';
import { windTurbineItem } from './elements/windTurbine';
import {
  advancedElementItems,
  canvasElementRegistry,
  DEFAULT_CANVAS_ELEMENT_CONFIG,
  defaultElementItems,
} from './registry';

describe('canvasElementRegistry', () => {
  it('registers all 14 built-in elements with unique ids', () => {
    const items = canvasElementRegistry.list();
    expect(items).toHaveLength(14);

    const ids = items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every registered item exposes the required fields', () => {
    for (const item of canvasElementRegistry.list()) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.display).toBeDefined();
      expect(typeof item.getNewOptions).toBe('function');
    }
  });

  it('lists the 9 default elements in order', () => {
    expect(defaultElementItems).toEqual([
      metricValueItem,
      textItem,
      ellipseItem,
      rectangleItem,
      iconItem,
      serverItem,
      triangleItem,
      cloudItem,
      parallelogramItem,
    ]);
  });

  it('lists the 5 advanced elements in order', () => {
    expect(advancedElementItems).toEqual([buttonItem, windTurbineItem, droneTopItem, droneFrontItem, droneSideItem]);
  });

  it('registers the default items followed by the advanced items', () => {
    expect(canvasElementRegistry.list()).toEqual([...defaultElementItems, ...advancedElementItems]);
  });

  it('does not register the notFound item', () => {
    const ids = canvasElementRegistry.list().map((item) => item.id);
    expect(ids).not.toContain(notFoundItem.id);
    expect(() => canvasElementRegistry.getIfExists(notFoundItem.id)).not.toThrow();
    expect(canvasElementRegistry.getIfExists(notFoundItem.id)).toBeUndefined();
  });

  describe('DEFAULT_CANVAS_ELEMENT_CONFIG', () => {
    it('defaults to the metric value element', () => {
      expect(DEFAULT_CANVAS_ELEMENT_CONFIG.type).toBe(metricValueItem.id);
      expect(DEFAULT_CANVAS_ELEMENT_CONFIG.name).toBe('Element 1');
    });

    it('merges the metric value default size into placement', () => {
      expect(DEFAULT_CANVAS_ELEMENT_CONFIG.placement).toMatchObject({
        width: metricValueItem.defaultSize!.width,
        height: metricValueItem.defaultSize!.height,
        rotation: 0,
      });
    });
  });
});
