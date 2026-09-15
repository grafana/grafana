// ol-mapbox-style and geotiff fail to parse under jest; stub them so the real
// layer registry (and everything it transitively imports) can still load.
jest.mock('ol-mapbox-style', () => ({}));
jest.mock('geotiff', () => ({}));

import LayerGroup from 'ol/layer/Group';
import TileLayer from 'ol/layer/Tile';
import { type Attribution } from 'ol/source/Source';
import XYZ from 'ol/source/XYZ';

import { guardLayerAttribution } from './attribution';

const frameState = {} as Parameters<Attribution>[0];

const tileLayer = (attributions?: string) =>
  new TileLayer({ source: new XYZ({ url: 'http://x/{z}/{x}/{y}', attributions }) });

const attributionOf = (layer: TileLayer<XYZ>) => {
  const attributions = layer.getSource()?.getAttributions();
  return attributions ? attributions(frameState) : null;
};

const attributionsOf = (layer: TileLayer<XYZ>) => {
  const attribution = attributionOf(layer);
  if (attribution == null) {
    return [];
  }
  return Array.isArray(attribution) ? attribution : [attribution];
};

const XSS_ATTRIBUTION = '<img src="x" onerror="window.__pwned = 1">';
const SAFE_ATTRIBUTION = '<img src="x">';
const LEGITIMATE_ATTRIBUTION = '<a href="https://carto.com/attribution/">©CARTO</a>';

describe('guardLayerAttribution', () => {
  it('filters attribution the source was created with', () => {
    const layer = tileLayer(XSS_ATTRIBUTION);

    guardLayerAttribution(layer);

    expect(attributionsOf(layer)).toEqual([SAFE_ATTRIBUTION]);
  });

  it('filters attribution the source picks up later', () => {
    const layer = tileLayer();
    guardLayerAttribution(layer);

    layer.getSource()?.setAttributions(XSS_ATTRIBUTION);

    expect(attributionsOf(layer)).toEqual([SAFE_ATTRIBUTION]);
  });

  it('filters attribution a source reports through a function', () => {
    const layer = tileLayer();
    guardLayerAttribution(layer);

    layer.getSource()?.setAttributions(() => [XSS_ATTRIBUTION]);

    expect(attributionsOf(layer)).toEqual([SAFE_ATTRIBUTION]);
  });

  it('strips a script payload', () => {
    const layer = tileLayer('<script>window.__pwned = 1</script>© Tiles');

    guardLayerAttribution(layer);

    expect(attributionsOf(layer)).toEqual(['© Tiles']);
  });

  it('strips an iframe rather than leaving a blank entry', () => {
    const layer = tileLayer('<iframe src="https://tiles.example/beacon"></iframe>');

    guardLayerAttribution(layer);

    expect(attributionsOf(layer)).toEqual([]);
  });

  it('marks a link that opens in a new tab as noopener', () => {
    const layer = tileLayer('<a href="https://www.openstreetmap.org/copyright" target="_blank">©OpenStreetMap</a>');

    guardLayerAttribution(layer);

    expect(attributionsOf(layer)).toEqual([
      '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">©OpenStreetMap</a>',
    ]);
  });

  it('keeps the markup a real attribution needs', () => {
    const layer = tileLayer(LEGITIMATE_ATTRIBUTION);

    guardLayerAttribution(layer);

    expect(attributionsOf(layer)).toEqual([LEGITIMATE_ATTRIBUTION]);
  });

  it('filters the sources inside nested layer groups', () => {
    const child = tileLayer(XSS_ATTRIBUTION);
    const group = new LayerGroup({ layers: [new LayerGroup({ layers: [child] })] });

    guardLayerAttribution(group);

    expect(attributionsOf(child)).toEqual([SAFE_ATTRIBUTION]);
  });

  it('filters layers added to the group after it was guarded', () => {
    const group = new LayerGroup({ layers: [] });
    guardLayerAttribution(group);

    // A layer built from a remote style adds its layers once the style has loaded
    const child = tileLayer(XSS_ATTRIBUTION);
    group.getLayers().push(child);

    expect(attributionsOf(child)).toEqual([SAFE_ATTRIBUTION]);
  });

  it('leaves a source alone when it carries no attribution', () => {
    // A data layer reads the features it loaded on the source's change event, so guarding a source
    // must not mark it as changed
    const layer = tileLayer();
    const onChange = jest.fn();
    layer.getSource()?.on('change', onChange);

    guardLayerAttribution(layer);

    expect(onChange).not.toHaveBeenCalled();
  });

  it('filters a source put on the layer after it was guarded', () => {
    const layer = tileLayer();
    guardLayerAttribution(layer);

    layer.setSource(new XYZ({ url: 'http://x/{z}/{x}/{y}', attributions: XSS_ATTRIBUTION }));

    expect(attributionsOf(layer)).toEqual([SAFE_ATTRIBUTION]);
  });
});
