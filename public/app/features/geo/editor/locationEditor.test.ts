import { PanelOptionsEditorBuilder, standardEditorsRegistry } from '@grafana/data';
import { FrameGeometrySourceMode, type FrameGeometrySource } from '@grafana/schema';

import { addLocationFields } from './locationEditor';
import { LocationModeEditor } from './locationModeEditor';

// addFieldNamePicker/addCustomEditor resolve built-in editors from the standard editors
// registry, which isn't populated outside the app runtime. Stub the ids this file needs.
const StubEditor = () => null;
standardEditorsRegistry.setInit(() => [{ id: 'field-name', name: 'field-name', editor: StubEditor }]);

function buildItems(source?: FrameGeometrySource, modes?: FrameGeometrySourceMode[]) {
  const builder = new PanelOptionsEditorBuilder<{ location: FrameGeometrySource }>();
  addLocationFields('Location', 'location.', builder, source, undefined, modes);
  return builder.getItems();
}

describe('addLocationFields', () => {
  it('shows the mode picker and no field picker when the mode is unset and multiple modes are allowed', () => {
    const items = buildItems(undefined, [
      FrameGeometrySourceMode.Auto,
      FrameGeometrySourceMode.Coords,
      FrameGeometrySourceMode.Geohash,
      FrameGeometrySourceMode.Lookup,
    ]);
    expect(items.find((i) => i.path === 'location.mode')).toBeDefined();
    expect(items.find((i) => i.path === 'location.geometry')).toBeUndefined();
  });

  it('passes the allowed modes through to the mode picker so it can filter its options', () => {
    const modes = [FrameGeometrySourceMode.Auto, FrameGeometrySourceMode.Coords];
    const items = buildItems(undefined, modes);
    const modeItem = items.find((i) => i.path === 'location.mode')!;
    expect(modeItem.editor).toBe(LocationModeEditor);
    expect(modeItem.settings).toMatchObject({ modes });
  });

  it('adds the field pickers matching the configured mode', () => {
    const items = buildItems({ mode: FrameGeometrySourceMode.Coords, latitude: 'lat', longitude: 'lon' }, [
      FrameGeometrySourceMode.Auto,
      FrameGeometrySourceMode.Coords,
    ]);
    expect(items.find((i) => i.path === 'location.latitude')).toBeDefined();
    expect(items.find((i) => i.path === 'location.longitude')).toBeDefined();
  });

  it('still shows the mode picker even when only one mode is allowed', () => {
    const items = buildItems(undefined, [FrameGeometrySourceMode.Wkt]);
    expect(items.find((i) => i.path === 'location.mode')).toBeDefined();
    // No source.mode is set, so no field picker case matches yet.
    expect(items.find((i) => i.path === 'location.geometry')).toBeUndefined();
  });

  it('leaves modes unrestricted (undefined) when no modes list is given, preserving every mode', () => {
    const items = buildItems({ mode: FrameGeometrySourceMode.Wkt, geometry: 'geom' }, undefined);
    const modeItem = items.find((i) => i.path === 'location.mode')!;
    expect(modeItem.settings).toMatchObject({ modes: undefined });
    expect(items.find((i) => i.path === 'location.geometry')).toBeDefined();
  });

  it.each([FrameGeometrySourceMode.Wkt, FrameGeometrySourceMode.Wkb, FrameGeometrySourceMode.GeoJson])(
    'shares the same geometry field picker for %s mode',
    (mode) => {
      const items = buildItems({ mode, geometry: 'geom' }, [
        FrameGeometrySourceMode.Wkt,
        FrameGeometrySourceMode.Wkb,
        FrameGeometrySourceMode.GeoJson,
      ]);
      expect(items.find((i) => i.path === 'location.geometry')).toBeDefined();
    }
  );
});
