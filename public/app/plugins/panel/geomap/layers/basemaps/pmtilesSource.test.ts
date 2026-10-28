import Feature from 'ol/Feature';
import TileState from 'ol/TileState';
import VectorTile from 'ol/VectorTile';
import type MVT from 'ol/format/MVT';

// The archive is read over the network, so stand in for the library that does the reading
const mockGetHeader = jest.fn();
const mockGetZxy = jest.fn();
jest.mock('pmtiles', () => ({
  PMTiles: jest.fn().mockImplementation(() => ({ getHeader: mockGetHeader, getZxy: mockGetZxy })),
}));

import { PMTilesVectorSource } from './pmtilesSource';

const ARCHIVE_URL = 'https://tiles.example.com/planet.pmtiles';
const decoded = [new Feature()];
const format = { readFeatures: jest.fn(() => decoded) } as unknown as MVT;

/** Resolves once every pending promise callback has run */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function createSource() {
  return new PMTilesVectorSource({ url: ARCHIVE_URL, format });
}

/** A real OpenLayers tile wired to the source's loader, the way the source's own tile cache builds them */
function loadTile(source: PMTilesVectorSource, z = 10, x = 163, y = 395) {
  const tile = new VectorTile(
    [z, x, y],
    TileState.IDLE,
    `${ARCHIVE_URL}#${z}/${x}/${y}`,
    format,
    source.getTileLoadFunction()
  );
  tile.load();
  return tile;
}

describe('PMTilesVectorSource', () => {
  beforeEach(() => {
    mockGetHeader.mockReset().mockResolvedValue({});
    mockGetZxy.mockReset();
  });

  describe('archive header', () => {
    it('is ready once the header is read', async () => {
      const source = createSource();
      expect(source.getState()).toBe('loading');

      await settle();

      expect(source.getState()).toBe('ready');
    });

    it('moves to the error state with the cause when the header cannot be read', async () => {
      const cause = new Error('Bad response code: 404');
      mockGetHeader.mockRejectedValue(cause);
      const source = createSource();

      await settle();

      expect(source.getState()).toBe('error');
      expect(source.getError()).toBe(cause);
    });
  });

  describe('tiles', () => {
    it('reads the tile at its coordinates and sets its decoded features', async () => {
      mockGetZxy.mockResolvedValue({ data: new ArrayBuffer(8) });
      const source = createSource();

      const tile = loadTile(source, 10, 163, 395);
      await settle();

      expect(mockGetZxy).toHaveBeenCalledWith(10, 163, 395);
      expect(tile.getState()).toBe(TileState.LOADED);
      expect(tile.getFeatures()).toBe(decoded);
    });

    it('marks a tile the archive does not contain as empty', async () => {
      mockGetZxy.mockResolvedValue(undefined);
      const source = createSource();

      const tile = loadTile(source);
      await settle();

      expect(tile.getState()).toBe(TileState.EMPTY);
    });

    it('marks a tile whose request fails as errored', async () => {
      mockGetZxy.mockRejectedValue(new Error('network down'));
      const source = createSource();

      const tile = loadTile(source);
      await settle();

      expect(tile.getState()).toBe(TileState.ERROR);
    });
  });
});
