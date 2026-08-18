import type BaseLayer from 'ol/layer/Base';
import TileLayer from 'ol/layer/Tile';
import type Source from 'ol/source/Source';

type Constructor<T> = (abstract new (...args: never[]) => T) & { readonly name: string };

/**
 * MapLayerHandler.init() is only typed as returning a BaseLayer, so tests have to narrow down to
 * the layer they expect. Throwing keeps a wrong layer type reported where it happens instead of
 * as an unrelated failure further down the test.
 */
export function ensureInstanceOf<T>(value: unknown, ctor: Constructor<T>): T {
  if (!(value instanceof ctor)) {
    throw new Error(`expected an instance of ${ctor.name}`);
  }
  return value;
}

/** Narrow a layer down to the tile source under test */
export function getTileSource<T extends Source>(layer: BaseLayer, sourceType: Constructor<T>): T {
  return ensureInstanceOf(ensureInstanceOf(layer, TileLayer).getSource(), sourceType);
}
