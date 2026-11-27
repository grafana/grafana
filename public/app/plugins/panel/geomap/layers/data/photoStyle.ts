import Photo from 'ol-ext/style/Photo';

let nextInstanceId = 0;

/**
 * Since OpenLayers 10.8, RegularShape shares rendered images between styles with the same render options,
 * and swaps each cached canvas for an ImageBitmap snapshot. ol-ext's Photo draws its photo into its canvas when
 * the image loads, which never reaches a shared snapshot. A second Photo with the same options gets the
 * snapshot of the empty frame, never loads its own image, and so never shows the photo.
 *
 * Adding a per-instance value to the render options keeps one image per Photo, as before OpenLayers 10.8.
 */
export class PhotoStyle extends Photo {
  // `declare` emits no field initializer. Photo's constructor sets this field first (through createRenderOptions),
  // and an initializer would then reset it.
  declare private instanceId?: number;

  protected createRenderOptions() {
    this.instanceId ??= nextInstanceId++;
    return { ...super.createRenderOptions(), instanceId: this.instanceId };
  }
}
