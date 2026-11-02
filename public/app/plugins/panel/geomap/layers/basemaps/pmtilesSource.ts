import TileState from 'ol/TileState';
import VectorTile from 'ol/VectorTile';
import type RenderFeature from 'ol/render/Feature';
import VectorTileSource, { type Options as VectorTileSourceOptions } from 'ol/source/VectorTile';
import { PMTiles } from 'pmtiles';

interface PMTilesVectorSourceOptions
  extends Omit<
    VectorTileSourceOptions<RenderFeature>,
    'state' | 'tileLoadFunction' | 'tileUrlFunction' | 'url' | 'urls'
  > {
  /** A PMTiles archive served with HTTP range requests */
  url: string;
}

/**
 * Reads vector tiles straight out of one PMTiles archive with HTTP range requests. If the archive's
 * header can't be read the source moves to the `error` state with the cause in `getError()`.
 */
export class PMTilesVectorSource extends VectorTileSource<RenderFeature> {
  private readonly archive: PMTiles;
  private readonly archiveUrl: string;
  private loadError: unknown;

  constructor({ url, ...options }: PMTilesVectorSourceOptions) {
    super({ ...options, state: 'loading' });
    this.archiveUrl = url;
    this.archive = new PMTiles(url);
    // OpenLayers keys its tile cache on these, so anything unique to the tile will do
    this.setTileUrlFunction(([z, x, y]) => `${url}#${z}/${x}/${y}`);
    this.setTileLoadFunction((tile) => {
      if (tile instanceof VectorTile) {
        this.loadTile(tile);
      }
    });

    this.archive.getHeader().then(
      () => this.setState('ready'),
      (error) => {
        this.loadError = error;
        this.setState('error');
      }
    );
  }

  getArchiveUrl() {
    return this.archiveUrl;
  }

  /** Why the archive couldn't be opened, once the source is in the `error` state */
  getError() {
    return this.loadError;
  }

  private loadTile(tile: VectorTile<RenderFeature>) {
    const [z, x, y] = tile.getTileCoord();
    tile.setLoader((extent, _resolution, projection) => {
      this.archive
        .getZxy(z, x, y)
        .then((response) => {
          if (!response) {
            tile.setFeatures([]);
            tile.setState(TileState.EMPTY);
            return;
          }
          tile.setFeatures(tile.getFormat().readFeatures(response.data, { extent, featureProjection: projection }));
        })
        .catch(() => tile.onError());
    });
  }
}
