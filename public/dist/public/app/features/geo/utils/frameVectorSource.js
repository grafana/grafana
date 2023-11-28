import { Feature } from 'ol';
import { LineString } from 'ol/geom';
import VectorSource from 'ol/source/Vector';
import { getGeometryField } from './location';
export class FrameVectorSource extends VectorSource {
    constructor(location) {
        super({});
        this.location = location;
    }
    update(frame) {
        this.clear(true);
        const info = getGeometryField(frame, this.location);
        if (!info.field) {
            this.changed();
            return;
        }
        for (let i = 0; i < frame.length; i++) {
            this.addFeatureInternal(new Feature({
                frame,
                rowIndex: i,
                geometry: info.field.values[i],
            }));
        }
        // only call this at the end
        this.changed();
    }
    updateLineString(frame) {
        this.clear(true);
        const info = getGeometryField(frame, this.location);
        if (!info.field) {
            this.changed();
            return;
        }
        //eslint-disable-next-line
        const field = info.field;
        const geometry = new LineString(field.values.map((p) => p.getCoordinates()));
        this.addFeatureInternal(new Feature({
            frame,
            rowIndex: 0,
            geometry: geometry,
        }));
        // only call this at the end
        this.changed();
    }
}
//# sourceMappingURL=frameVectorSource.js.map